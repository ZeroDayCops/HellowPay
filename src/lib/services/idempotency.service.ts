/**
 * HollowPay — Idempotency Engine
 *
 * Prevents duplicate operations (like double order creation) when clients
 * retry requests due to network timeouts.
 * Checks the 'Idempotency-Key' HTTP header.
 */

import { db } from '@/lib/db';
import { idempotencyRecords } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { sha256 } from '@/lib/crypto/hash';
import { IdempotencyError } from '@/lib/api/errors';
import { IDEMPOTENCY_EXPIRY_MS } from '@/lib/constants';

// 15 second lock timeout
const LOCK_TIMEOUT_MS = 15 * 1000;

export interface IdempotencyResult {
  /** If true, the response was served from cache */
  isCached: boolean;
  /** Cached status code */
  statusCode?: number;
  /** Cached response payload */
  responseBody?: unknown;
}

/**
 * Validates, records, and locks an idempotency key.
 *
 * @returns Result if cached response exists, null otherwise (key locked for execution)
 */
export async function getOrLockIdempotencyKey(
  projectId: number,
  environment: 'test' | 'live',
  key: string,
  endpoint: string,
  requestBodyPayload: string
): Promise<IdempotencyResult | null> {
  const keyHash = sha256(key);
  const requestFingerprint = sha256(requestBodyPayload);
  const now = new Date();

  // 1. Check for existing key in database
  const records = await db
    .select()
    .from(idempotencyRecords)
    .where(
      and(
        eq(idempotencyRecords.projectId, projectId),
        eq(idempotencyRecords.environment, environment),
        eq(idempotencyRecords.keyHash, keyHash)
      )
    )
    .limit(1);

  if (records.length > 0) {
    const record = records[0];

    // Check expiration
    if (record.expiresAt.getTime() < now.getTime()) {
      // Key expired, delete old record
      await db.delete(idempotencyRecords).where(eq(idempotencyRecords.id, record.id));
    } else {
      // Verify fingerprint matches to prevent hash collision spoofing
      if (record.requestFingerprint !== requestFingerprint) {
        throw new IdempotencyError('Idempotency key was reused with a different request payload.');
      }

      // If it has a completed response, return it directly
      if (record.responseStatus !== null) {
        return {
          isCached: true,
          statusCode: record.responseStatus,
          responseBody: record.responseBody,
        };
      }

      // If it is locked but lock has timed out, reset lock
      if (record.lockedAt && record.lockedUntil && record.lockedUntil.getTime() < now.getTime()) {
        await db
          .update(idempotencyRecords)
          .set({
            lockedAt: now,
            lockedUntil: new Date(now.getTime() + LOCK_TIMEOUT_MS),
          })
          .where(eq(idempotencyRecords.id, record.id));
        return null;
      }

      // Otherwise, request is currently in-progress
      throw new IdempotencyError('An identical request is currently processing. Please try again in a few seconds.');
    }
  }

  // 2. Create new locked record
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_EXPIRY_MS);
  const lockedUntil = new Date(now.getTime() + LOCK_TIMEOUT_MS);

  await db.insert(idempotencyRecords).values({
    projectId,
    environment,
    endpoint,
    keyHash,
    requestFingerprint,
    expiresAt,
    lockedAt: now,
    lockedUntil,
  });

  return null;
}

/**
 * Saves the completed response to the idempotency record and unlocks it.
 */
export async function saveIdempotencyResponse(
  projectId: number,
  environment: 'test' | 'live',
  key: string,
  statusCode: number,
  responseBody: unknown,
  resourceId?: string
): Promise<void> {
  const keyHash = sha256(key);

  await db
    .update(idempotencyRecords)
    .set({
      responseStatus: statusCode,
      responseBody: responseBody,
      resourceId,
      lockedAt: null,
      lockedUntil: null,
    })
    .where(
      and(
        eq(idempotencyRecords.projectId, projectId),
        eq(idempotencyRecords.environment, environment),
        eq(idempotencyRecords.keyHash, keyHash)
      )
    );
}

/**
 * Unlocks a key if the request failed before completion (to allow immediate retrying).
 */
export async function unlockIdempotencyKey(
  projectId: number,
  environment: 'test' | 'live',
  key: string
): Promise<void> {
  const keyHash = sha256(key);
  
  await db
    .delete(idempotencyRecords)
    .where(
      and(
        eq(idempotencyRecords.projectId, projectId),
        eq(idempotencyRecords.environment, environment),
        eq(idempotencyRecords.keyHash, keyHash),
        isNull(idempotencyRecords.responseStatus) // Only delete if not succeeded
      )
    );
}
