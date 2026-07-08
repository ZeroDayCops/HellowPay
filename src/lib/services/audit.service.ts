/**
 * HollowPay — Audit Logging Service
 *
 * Records immutable audit logs for all sensitive system and merchant operations.
 * Automatically extracts actor credentials and request metadata from RequestContext.
 */

import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { getRequestStore } from '@/lib/api/request-context';
import { generatePublicId } from '@/lib/crypto/id-generator';

export interface AuditLogOptions {
  action: string;
  targetType?: string;
  targetId?: string;
  result?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  workspaceId?: number; // Override if context is not available
  userId?: number;      // Override if context is not available
}

/**
 * Creates an audit log entry in the database.
 * Automatically populates metadata from request context if available.
 */
export async function createAuditLog(options: AuditLogOptions): Promise<string> {
  const context = getRequestStore();
  const publicId = generatePublicId('audit');

  // Derive values from context or fallback to options
  const workspaceId = context?.workspaceId ?? options.workspaceId ?? null;
  const actorType = context?.actorType ?? 'system';
  
  // Resolve actor user ID if user actor
  const actorId = context?.userId ?? options.userId ?? null;
  const requestId = context?.requestId ?? 'system';
  const ipAddress = context?.ipAddress ?? null;

  await db.insert(auditLogs).values({
    publicId,
    workspaceId,
    actorId,
    actorType,
    action: options.action,
    targetType: options.targetType ?? null,
    targetId: options.targetId ?? null,
    result: options.result ?? 'success',
    metadata: options.metadata ?? null,
    requestId,
    ipAddress,
  });

  return publicId;
}
