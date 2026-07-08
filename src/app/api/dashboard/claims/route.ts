/**
 * HollowPay — Dashboard Claims API
 *
 * GET /api/dashboard/claims
 * Lists payment claims for the merchant's project, with pagination and status filtering.
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
  paymentAttempts,
  orders,
  checkoutSessions,
} from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';
  const statusFilter = searchParams.get('status'); // 'pending' | 'confirmed' | 'rejected' | null (all)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

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

    const workspaceId = membership[0].workspaceId;

    const biz = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, workspaceId))
      .limit(1);

    if (biz.length === 0) {
      return NextResponse.json({ claims: [], total: 0, page, limit });
    }

    const proj = await db
      .select()
      .from(projects)
      .where(eq(projects.businessId, biz[0].id))
      .limit(1);

    if (proj.length === 0) {
      return NextResponse.json({ claims: [], total: 0, page, limit });
    }

    const projectId = proj[0].id;

    // 2. Build where conditions
    const baseConditions = [
      eq(paymentClaims.projectId, projectId),
      eq(orders.environment, environment),
    ];

    if (statusFilter && ['pending', 'confirmed', 'rejected'].includes(statusFilter)) {
      baseConditions.push(eq(paymentClaims.status, statusFilter));
    }

    // 3. Get total count
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)::integer` })
      .from(paymentClaims)
      .innerJoin(orders, eq(paymentClaims.orderId, orders.id))
      .where(and(...baseConditions));

    const total = countResult[0]?.count ?? 0;

    // 4. Fetch paginated claims with order + attempt details
    const claimsResult = await db
      .select({
        claimId: paymentClaims.id,
        claimPublicId: paymentClaims.publicId,
        claimStatus: paymentClaims.status,
        claimedReference: paymentClaims.claimedReference,
        screenshotObjectKey: paymentClaims.screenshotObjectKey,
        claimedAt: paymentClaims.claimedAt,
        reviewedAt: paymentClaims.reviewedAt,
        reviewReason: paymentClaims.reviewReason,
        orderPublicId: orders.publicId,
        orderAmountMinor: orders.amountMinor,
        orderCurrency: orders.currency,
        orderStatus: orders.status,
        orderDescription: orders.description,
        attemptPublicId: paymentAttempts.publicId,
        attemptStatus: paymentAttempts.status,
        sessionPublicId: checkoutSessions.publicId,
      })
      .from(paymentClaims)
      .innerJoin(orders, eq(paymentClaims.orderId, orders.id))
      .innerJoin(paymentAttempts, eq(paymentClaims.paymentAttemptId, paymentAttempts.id))
      .leftJoin(checkoutSessions, eq(paymentClaims.checkoutSessionId, checkoutSessions.id))
      .where(and(...baseConditions))
      .orderBy(desc(paymentClaims.claimedAt))
      .limit(limit)
      .offset(offset);

    // 5. Status summary counts
    const summaryResult = await db
      .select({
        status: paymentClaims.status,
        count: sql<number>`COUNT(*)::integer`,
      })
      .from(paymentClaims)
      .innerJoin(orders, eq(paymentClaims.orderId, orders.id))
      .where(
        and(
          eq(paymentClaims.projectId, projectId),
          eq(orders.environment, environment)
        )
      )
      .groupBy(paymentClaims.status);

    const summary: Record<string, number> = {};
    for (const row of summaryResult) {
      summary[row.status] = row.count;
    }

    return NextResponse.json({
      claims: claimsResult,
      total,
      page,
      limit,
      summary,
    });
  } catch (error) {
    console.error('Failed to fetch claims:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
