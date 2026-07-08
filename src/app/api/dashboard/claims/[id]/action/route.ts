/**
 * HollowPay — Dashboard Claim Action API
 *
 * POST /api/dashboard/claims/[id]/action
 * Body: { action: 'approve' | 'reject', reason?: string }
 *
 * Invokes domain service to confirm or reject a pending payment claim.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  userProfiles,
  workspaceMembers,
  businesses,
  projects,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { confirmPaymentClaim, rejectPaymentClaim } from '@/lib/services/payment.service';
import { sendMerchantNotification } from '@/lib/services/notification.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: claimPublicId } = await params;

  let body: { action: string; reason?: string; env?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, reason } = body;
  const environment = body.env === 'live' ? 'live' : 'test';

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid action. Must be "approve" or "reject".' },
      { status: 400 }
    );
  }

  try {
    // 1. Resolve user → workspace → project
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userId = profile[0].id;

    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const biz = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, membership[0].workspaceId))
      .limit(1);

    if (biz.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const proj = await db
      .select()
      .from(projects)
      .where(eq(projects.businessId, biz[0].id))
      .limit(1);

    if (proj.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectId = proj[0].id;

    // 2. Execute domain action
    if (action === 'approve') {
      const result = await confirmPaymentClaim(
        projectId,
        environment as 'test' | 'live',
        claimPublicId,
        `merchant:${clerkUserId}`,
        userId
      );

      await sendMerchantNotification(
        projectId,
        'claim.confirmed',
        'Payment Claim Confirmed',
        `Payment claim with UTR "${result.claim.claimedReference}" has been approved by ${profile[0].name || 'merchant'}.`,
        `/dashboard/claims/${claimPublicId}`
      );

      return NextResponse.json({
        success: true,
        action: 'approved',
        claimId: claimPublicId,
        transactionId: result.txn.publicId,
        orderPublicId: result.orderPublicId,
      });
    } else {
      const result = await rejectPaymentClaim(
        projectId,
        environment as 'test' | 'live',
        claimPublicId,
        `merchant:${clerkUserId}`,
        reason || 'Rejected by merchant'
      );

      await sendMerchantNotification(
        projectId,
        'claim.rejected',
        'Payment Claim Rejected',
        `Payment claim with UTR "${result.claim.claimedReference}" has been rejected by ${profile[0].name || 'merchant'}.${reason ? ` Reason: ${reason}` : ''}`,
        `/dashboard/claims/${claimPublicId}`
      );

      return NextResponse.json({
        success: true,
        action: 'rejected',
        claimId: claimPublicId,
        orderPublicId: result.orderPublicId,
      });
    }
  } catch (error: unknown) {
    console.error('Claim action failed:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
