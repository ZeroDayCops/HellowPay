/**
 * HollowPay — API Key Authentication
 *
 * Verifies API keys from the incoming request Authorization headers.
 * Resolves the key to its project, environment, and workspace.
 */

import { db } from '@/lib/db';
import { apiKeys, projects, businesses } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { hashApiKey, isValidApiKeyFormat } from '@/lib/crypto/api-key-generator';
import { UnauthorizedError } from '@/lib/api/errors';
import { RequestStore } from '@/lib/api/request-context';

export interface AuthenticatedContext {
  projectId: number;
  workspaceId: number;
  environment: 'test' | 'live';
  apiKeyId: number;
  apiKeyPrefix: string;
}

/**
 * Parses the Authorization header and authenticates the API key.
 *
 * @param authHeader - Value of the Authorization header (e.g. "Bearer hp_test_sk_...")
 * @returns Authenticated project and workspace details
 * @throws UnauthorizedError if invalid or revoked
 */
export async function authenticateApiKey(
  authHeader: string | null | undefined
): Promise<AuthenticatedContext> {
  if (!authHeader) {
    throw new UnauthorizedError('Missing Authorization header. Use Bearer token auth.');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new UnauthorizedError('Invalid Authorization header format. Expected "Bearer <api_key>".');
  }

  const apiKeyString = parts[1];
  if (!isValidApiKeyFormat(apiKeyString)) {
    throw new UnauthorizedError('Invalid API key format.');
  }

  const keyHash = hashApiKey(apiKeyString);

  // Retrieve the key and join up to business/workspace
  const results = await db
    .select({
      apiKeyId: apiKeys.id,
      apiKeyPrefix: apiKeys.prefix,
      projectId: apiKeys.projectId,
      environment: apiKeys.environment,
      revokedAt: apiKeys.revokedAt,
      workspaceId: businesses.workspaceId,
    })
    .from(apiKeys)
    .innerJoin(projects, eq(apiKeys.projectId, projects.id))
    .innerJoin(businesses, eq(projects.businessId, businesses.id))
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt)
      )
    )
    .limit(1);

  if (results.length === 0) {
    throw new UnauthorizedError('Invalid or revoked API key.');
  }

  const authData = results[0];

  return {
    projectId: authData.projectId,
    workspaceId: authData.workspaceId,
    environment: authData.environment as 'test' | 'live',
    apiKeyId: authData.apiKeyId,
    apiKeyPrefix: authData.apiKeyPrefix,
  };
}

/**
 * Helper to update request store context with authenticated values.
 */
export function populateAuthInContext(
  store: RequestStore,
  auth: AuthenticatedContext
): RequestStore {
  return {
    ...store,
    projectId: auth.projectId,
    workspaceId: auth.workspaceId,
    environment: auth.environment,
    actorType: 'api',
    actorId: auth.apiKeyPrefix,
  };
}
