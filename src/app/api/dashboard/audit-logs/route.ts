/**
 * HollowPay — Audit Logs Dashboard API
 *
 * GET /api/dashboard/audit-logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, auditLogs } from '@/lib/db/schema';
import { eq, and, desc, like } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const actionFilter = searchParams.get('action') || undefined;
  const resultFilter = searchParams.get('result') || undefined;
  
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    // 1. Resolve project/workspace contexts
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, profile[0].id))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceId = membership[0].workspaceId;

    // 2. Build where conditions
    const conditions = [eq(auditLogs.workspaceId, workspaceId)];
    
    if (actionFilter) {
      conditions.push(like(auditLogs.action, `%${actionFilter}%`));
    }
    if (resultFilter && (resultFilter === 'success' || resultFilter === 'failure')) {
      conditions.push(eq(auditLogs.result, resultFilter));
    }

    // 3. Query logs
    const list = await db
      .select({
        id: auditLogs.id,
        publicId: auditLogs.publicId,
        actorId: auditLogs.actorId,
        actorType: auditLogs.actorType,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        result: auditLogs.result,
        metadata: auditLogs.metadata,
        requestId: auditLogs.requestId,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        actorEmail: userProfiles.email,
        actorName: userProfiles.name,
      })
      .from(auditLogs)
      .leftJoin(userProfiles, eq(auditLogs.actorId, userProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalCountResult = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(...conditions));

    return NextResponse.json({
      logs: list,
      totalCount: totalCountResult.length,
    });
  } catch (error: unknown) {
    console.error('Failed to query audit logs:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
