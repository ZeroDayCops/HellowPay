/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — Standard API Route Wrapper
 *
 * Wraps route handlers to automatically handle request context,
 * API key authentication, idempotency validation, and centralized error parsing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runInRequestContext, RequestStore } from './request-context';
import { handleApiError } from './errors';
import { authenticateApiKey, populateAuthInContext } from '@/lib/auth/api-auth';
import { generateRequestId } from '@/lib/crypto/id-generator';
import {
  getOrLockIdempotencyKey,
  saveIdempotencyResponse,
  unlockIdempotencyKey,
} from '@/lib/services/idempotency.service';

export type HandlerFunction = (
  req: NextRequest,
  ...args: any[]
) => Promise<NextResponse> | NextResponse;

interface RouteHandlerOptions {
  /** Whether the route requires API key authentication (default: true) */
  authRequired?: boolean;
}

/**
 * Higher-order function to wrap route handlers.
 * Handles:
 * 1. Request ID generation
 * 2. Logging and audit prep
 * 3. API key auth (if configured)
 * 4. Idempotency Key checks (for POST requests)
 * 5. Request context scope
 * 6. standard JSON errors serialization
 *
 * @param handler - The route handler function
 * @param options - Configuration options
 * @returns Wrapped Next.js route handler
 */
export function wrapRouteHandler(
  handler: HandlerFunction,
  options: RouteHandlerOptions = {}
) {
  const authRequired = options.authRequired ?? true;

  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const headers = req.headers;
    const ipAddress = headers.get('x-forwarded-for') ?? undefined;

    const initialStore: RequestStore = {
      requestId,
      ipAddress,
      path: req.nextUrl.pathname,
      method: req.method,
    };

    // Run the entire request lifetime in the AsyncLocalStorage context
    return runInRequestContext(initialStore, async () => {
      const idempotencyKey = headers.get('Idempotency-Key');
      const isPostRequest = req.method.toUpperCase() === 'POST';

      try {
        if (authRequired) {
          const authHeader = headers.get('Authorization');
          const authenticated = await authenticateApiKey(authHeader);
          
          // Populate authenticating details into RequestContext
          const store = populateAuthInContext(initialStore, authenticated);
          
          // Run with authentication context
          return await runInRequestContext(store, async () => {
            // Apply idempotency check for authenticated POST requests
            if (isPostRequest && idempotencyKey) {
              // Clone the request stream to read the body safely
              const bodyText = await req.clone().text();
              const cachedResult = await getOrLockIdempotencyKey(
                authenticated.projectId,
                authenticated.environment,
                idempotencyKey,
                req.nextUrl.pathname,
                bodyText
              );

              if (cachedResult && cachedResult.isCached) {
                // Return cached response directly
                return NextResponse.json(cachedResult.responseBody, {
                  status: cachedResult.statusCode,
                  headers: {
                    'HollowPay-Request-Id': requestId,
                    'X-Cache-Lookup': 'HIT',
                  },
                });
              }

              try {
                const response = await handler(req, ...args);
                
                // Read and cache the response body
                let responseBody: unknown = null;
                try {
                  responseBody = await response.clone().json();
                } catch {
                  // Fallback for non-JSON responses
                  try {
                    responseBody = { message: await response.clone().text() };
                  } catch {
                    responseBody = { message: 'No body returned' };
                  }
                }

                // Extract resourceId if present in response (e.g. { id: 'ord_hp_...' })
                const resourceId = (responseBody && typeof responseBody === 'object' && 'id' in responseBody)
                  ? String((responseBody as Record<string, unknown>).id)
                  : undefined;

                await saveIdempotencyResponse(
                  authenticated.projectId,
                  authenticated.environment,
                  idempotencyKey,
                  response.status,
                  responseBody,
                  resourceId
                );

                return response;
              } catch (handlerError) {
                // Request failed/crashed, unlock the key to allow retries
                await unlockIdempotencyKey(
                  authenticated.projectId,
                  authenticated.environment,
                  idempotencyKey
                );
                throw handlerError;
              }
            }

            // Normal authenticated execution (GET, etc. or no Idempotency-Key)
            return await handler(req, ...args);
          });
        }

        // Run handler without auth (e.g. webhook endpoint, public checkout)
        return await handler(req, ...args);
      } catch (error) {
        return handleApiError(error);
      }
    });
  };
}
