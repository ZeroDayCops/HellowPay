/**
 * HollowPay — Admin Audit Logs API
 *
 * GET /api/admin/audit-logs — Lists all audit logs (Admin-only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { auditLogs, userProfiles } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { checkAdminPrivilege } from '@/lib/auth/admin';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = await checkAdminPrivilege(clerkUserId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  try {
    const logs = await db
      .select({
        id: auditLogs.id,
        publicId: auditLogs.publicId,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        actorId: auditLogs.actorId,
        actorEmail: userProfiles.email,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(userProfiles, eq(auditLogs.actorId, userProfiles.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);

    return NextResponse.json({ logs });
  } catch (error: unknown) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
