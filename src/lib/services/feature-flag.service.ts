/**
 * HollowPay — Feature Flags Service
 */

import { db } from '@/lib/db';
import { featureFlags } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface FeatureFlagData {
  key: string;
  enabled: boolean;
  scope?: 'global' | 'workspace' | 'project';
  scopeId?: string | null;
  description?: string | null;
}

/**
 * Check if a feature flag is enabled.
 * Conforms to database unique constraint on flag key.
 */
export async function checkFeatureFlag(
  key: string,
  scope?: 'workspace' | 'project',
  scopeId?: string | null
): Promise<boolean> {
  const flags = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .limit(1);

  if (flags.length === 0) {
    return false;
  }

  const f = flags[0];

  // Global scope
  if (f.scope === 'global') {
    return f.enabled;
  }

  // Project scope
  if (f.scope === 'project') {
    if (scope === 'project' && scopeId === f.scopeId) {
      return f.enabled;
    }
    return false;
  }

  // Workspace scope
  if (f.scope === 'workspace') {
    if (scope === 'workspace' && scopeId === f.scopeId) {
      return f.enabled;
    }
    return false;
  }

  return false;
}

/**
 * Creates or updates a feature flag
 */
export async function setFeatureFlag(data: FeatureFlagData): Promise<any> {
  const scope = data.scope || 'global';
  const scopeId = data.scopeId || null;

  const existing = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, data.key))
    .limit(1);

  const now = new Date();

  if (existing.length > 0) {
    const [updated] = await db
      .update(featureFlags)
      .set({
        enabled: data.enabled,
        scope,
        scopeId,
        description: data.description ?? existing[0].description,
        updatedAt: now,
      })
      .where(eq(featureFlags.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(featureFlags)
      .values({
        key: data.key,
        enabled: data.enabled,
        scope,
        scopeId,
        description: data.description || null,
      })
      .returning();
    return inserted;
  }
}

/**
 * List all feature flags
 */
export async function listFeatureFlags(): Promise<any[]> {
  return db
    .select()
    .from(featureFlags)
    .orderBy(featureFlags.key);
}
