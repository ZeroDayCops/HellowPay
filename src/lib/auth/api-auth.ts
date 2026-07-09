/**
 * HollowPay — API Key Authentication
 *
 * Verifies API keys from the incoming request Authorization headers.
 * Resolves the key to its project, environment, and workspace.
 */

import { db } from '@/lib/db';
import { apiKeys, apiKeyUsage, projects, businesses } from '@/lib/db/schema';
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
      liveModeEnabled: projects.liveModeEnabled,
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

  // Block live API requests if Live Mode is not approved/enabled on project
  if (authData.environment === 'live' && !authData.liveModeEnabled) {
    throw new UnauthorizedError('Live Mode access is disabled or unapproved. Request compliance verification in Settings.');
  }

  // Asynchronously register usage statistics in background
  updateKeyUsage(authData.apiKeyId).catch((err) => {
    console.error('Failed to update API key activity in background:', err);
  });

  return {
    projectId: authData.projectId,
    workspaceId: authData.workspaceId,
    environment: authData.environment as 'test' | 'live',
    apiKeyId: authData.apiKeyId,
    apiKeyPrefix: authData.apiKeyPrefix,
  };
}

/**
 * Asynchronously logs key usage and daily call volumes.
 */
async function updateKeyUsage(apiKeyId: number) {
  const today = new Date().toISOString().substring(0, 10);
  try {
    await db.transaction(async (tx) => {
      // 1. Set key last used timestamp
      await tx
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, apiKeyId));

      // 2. Increment daily request count
      const usageList = await tx
        .select()
        .from(apiKeyUsage)
        .where(
          and(
            eq(apiKeyUsage.apiKeyId, apiKeyId),
            eq(apiKeyUsage.date, today)
          )
        )
        .limit(1);

      if (usageList.length > 0) {
        await tx
          .update(apiKeyUsage)
          .set({
            requestCount: usageList[0].requestCount + 1,
            lastUsedAt: new Date(),
          })
          .where(eq(apiKeyUsage.id, usageList[0].id));
      } else {
        await tx.insert(apiKeyUsage).values({
          apiKeyId,
          date: today,
          requestCount: 1,
          lastUsedAt: new Date(),
        });
      }
    });
  } catch (error) {
    console.error('Failed to update API key telemetry database:', error);
  }
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
