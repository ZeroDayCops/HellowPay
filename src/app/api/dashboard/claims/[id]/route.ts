/**
 * HollowPay — Dashboard Claim Detail API
 *
 * GET  /api/dashboard/claims/[id] — Fetch single claim detail (with full event timeline)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  userProfiles,
  workspaceMembers,
  businesses,
  projects,
  paymentClaims,
  paymentClaimEvents,
  paymentAttempts,
  paymentAttemptEvents,
  orders,
  orderEvents,
  checkoutSessions,
  transactions,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: claimPublicId } = await params;
  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';

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

    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, profile[0].id))
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

    // 2. Fetch claim with full context
    const claimResult = await db
      .select({
        claim: paymentClaims,
        order: orders,
        attempt: paymentAttempts,
        session: checkoutSessions,
      })
      .from(paymentClaims)
      .innerJoin(orders, eq(paymentClaims.orderId, orders.id))
      .innerJoin(paymentAttempts, eq(paymentClaims.paymentAttemptId, paymentAttempts.id))
      .leftJoin(checkoutSessions, eq(paymentClaims.checkoutSessionId, checkoutSessions.id))
      .where(
        and(
          eq(paymentClaims.projectId, projectId),
          eq(orders.environment, environment),
          eq(paymentClaims.publicId, claimPublicId)
        )
      )
      .limit(1);

    if (claimResult.length === 0) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const { claim, order, attempt, session } = claimResult[0];

    // 3. Fetch event timeline for the claim
    const claimEvents = await db
      .select()
      .from(paymentClaimEvents)
      .where(eq(paymentClaimEvents.paymentClaimId, claim.id))
      .orderBy(desc(paymentClaimEvents.createdAt));

    // 4. Fetch attempt events
    const attemptEvents = await db
      .select()
      .from(paymentAttemptEvents)
      .where(eq(paymentAttemptEvents.paymentAttemptId, attempt.id))
      .orderBy(desc(paymentAttemptEvents.createdAt));

    // 5. Fetch order events
    const ordEvents = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(desc(orderEvents.createdAt));

    // 6. Fetch transaction if claim was confirmed
    let transaction = null;
    if (claim.status === 'confirmed') {
      const txnResult = await db
        .select()
        .from(transactions)
        .where(eq(transactions.paymentClaimId, claim.id))
        .limit(1);

      if (txnResult.length > 0) {
        transaction = txnResult[0];
      }
    }

    // 7. Generate signed screenshot URL if present
    let screenshotUrl: string | null = null;
    if (claim.screenshotObjectKey) {
      // Construct R2 public URL
      const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
      if (r2PublicUrl) {
        screenshotUrl = `${r2PublicUrl}/${claim.screenshotObjectKey}`;
      }
    }

    return NextResponse.json({
      claim: {
        ...claim,
        screenshotUrl,
      },
      order,
      attempt,
      session,
      transaction,
      timeline: {
        claimEvents,
        attemptEvents,
        orderEvents: ordEvents,
      },
    });
  } catch (error) {
    console.error('Failed to fetch claim detail:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
