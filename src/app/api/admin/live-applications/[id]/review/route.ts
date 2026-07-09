/**
 * HollowPay — Admin Live Mode Application Review API
 *
 * POST /api/admin/live-applications/[id]/review — Review and approve/reject Live Mode requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  userProfiles,
  liveModeApplications,
  projects,
  auditLogs,
  businesses,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendMerchantNotification } from '@/lib/services/notification.service';
import { checkAdminPrivilege, getAdminProfile } from '@/lib/auth/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const appId = parseInt(resolvedParams.id, 10);

  if (isNaN(appId)) {
    return NextResponse.json({ error: 'Invalid application ID.' }, { status: 400 });
  }

  let body: {
    action: 'approve' | 'reject' | 'suspend';
    reason?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { action, reason } = body;

  if (!['approve', 'reject', 'suspend'].includes(action)) {
    return NextResponse.json({ error: "Invalid action. Must be 'approve', 'reject', or 'suspend'." }, { status: 400 });
  }

  try {
    // 1. Admin Gate
    const adminUser = await getAdminProfile(clerkUserId);
    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json({ error: 'Access denied: Requires administrator privilege.' }, { status: 403 });
    }

    // 3. Fetch target application
    const appList = await db
      .select()
      .from(liveModeApplications)
      .where(eq(liveModeApplications.id, appId))
      .limit(1);

    if (appList.length === 0) {
      return NextResponse.json({ error: 'Live Mode application not found.' }, { status: 404 });
    }

    const app = appList[0];

    // Map review action to target application status
    let targetStatus: 'approved' | 'rejected' | 'suspended';
    let liveEnabled = false;

    if (action === 'approve') {
      targetStatus = 'approved';
      liveEnabled = true;
    } else if (action === 'reject') {
      targetStatus = 'rejected';
      liveEnabled = false;
    } else {
      targetStatus = 'suspended';
      liveEnabled = false;
    }

    // 4. Update application status and project Live Mode flag inside a database transaction
    await db.transaction(async (tx) => {
      await tx
        .update(liveModeApplications)
        .set({
          status: targetStatus,
          reviewedAt: new Date(),
          reviewedBy: adminUser.id,
          reviewReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(liveModeApplications.id, appId));

      await tx
        .update(projects)
        .set({
          liveModeEnabled: liveEnabled,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, app.projectId));
    });

    // 5. Query workspaceId for audit logging
    const projectWorkspace = await db
      .select({ workspaceId: businesses.workspaceId })
      .from(projects)
      .innerJoin(businesses, eq(projects.businessId, businesses.id))
      .where(eq(projects.id, app.projectId))
      .limit(1);

    const actualWorkspaceId = projectWorkspace[0]?.workspaceId ?? 1;

    // 6. Write to immutable audit logs
    await db.insert(auditLogs).values({
      publicId: `aud_hp_${nanoid(16)}`,
      workspaceId: actualWorkspaceId,
      actorId: adminUser.id,
      action: `live_mode_${targetStatus}`,
      targetType: 'project',
      targetId: String(app.projectId),
      metadata: {
        applicationId: appId,
        reason: reason || null,
      },
    });

    await sendMerchantNotification(
      app.projectId,
      `live_mode.${targetStatus}`,
      `Live Mode Application ${targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1)}`,
      `Your request to enable Live Mode has been ${targetStatus}.${reason ? ` Reason: ${reason}` : ''}`,
      '/dashboard/settings'
    );

    return NextResponse.json({ success: true, status: targetStatus, liveModeEnabled: liveEnabled });
  } catch (error: unknown) {
    console.error('Failed to review live mode application:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
