/**
 * HollowPay — API Request Observability & Logging Service
 *
 * Implements security-focused sanitization and asynchronous storage of API transaction requests.
 */

import { db } from '@/lib/db';
import { apiRequestLogs } from '@/lib/db/schema';
import { generatePublicId } from '@/lib/crypto/id-generator';

// Sensitive keys to redact
const SENSITIVE_KEY_PATTERN = /auth|key|secret|token|password|clerk|cookie/i;

/**
 * Recursively sanitizes request/response bodies or headers to replace secrets with [REDACTED].
 */
export function sanitizePayload(payload: any): any {
  if (!payload) return payload;

  if (typeof payload === 'string') {
    // Check if it looks like a bearer header
    if (payload.toLowerCase().startsWith('bearer ')) {
      return 'Bearer [REDACTED]';
    }
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }

  if (typeof payload === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(payload)) {
      const val = payload[key];
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizePayload(val);
      }
    }
    return sanitized;
  }

  return payload;
}

interface LogApiRequestParams {
  method: string;
  path: string;
  statusCode?: number;
  durationMs?: number;
  requestHeaders?: any;
  requestBody?: any;
  responseBody?: any;
  ipAddress?: string;
  requestId?: string;
  apiKeyPrefix?: string;
  projectId?: number;
  environment?: 'test' | 'live';
}

/**
 * Non-blocking logger to capture REST API requests and record them to database.
 */
export async function logApiRequest(params: LogApiRequestParams): Promise<void> {
  const publicId = generatePublicId('request');

  // Sanitize payloads to protect merchant credentials and database keys
  const sanitizedHeaders = params.requestHeaders ? sanitizePayload(params.requestHeaders) : null;
  const sanitizedBody = params.requestBody ? sanitizePayload(params.requestBody) : null;
  const sanitizedResponse = params.responseBody ? sanitizePayload(params.responseBody) : null;

  // Insert asynchronously inside a try/catch to never block the caller thread
  try {
    await db.insert(apiRequestLogs).values({
      publicId,
      projectId: params.projectId || null,
      environment: params.environment || null,
      method: params.method,
      path: params.path,
      statusCode: params.statusCode || null,
      apiKeyPrefix: params.apiKeyPrefix || null,
      durationMs: params.durationMs || null,
      requestHeaders: sanitizedHeaders,
      requestBody: sanitizedBody,
      responseBody: sanitizedResponse,
      ipAddress: params.ipAddress || null,
      requestId: params.requestId || null,
    });
  } catch (error) {
    console.error('Failed to save API request log to database:', error);
  }
}
