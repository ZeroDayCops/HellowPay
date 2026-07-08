import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, orders } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse environment query param
  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';

  try {
    // 1. Resolve user profile
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ onboarded: false, metrics: null });
    }

    const userId = profile[0].id;

    // 2. Resolve workspace and projects
    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ onboarded: false, metrics: null });
    }

    const workspaceId = membership[0].workspaceId;

    // Find the business and project
    const biz = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, workspaceId))
      .limit(1);

    if (biz.length === 0) {
      return NextResponse.json({ onboarded: false, metrics: null });
    }

    const proj = await db
      .select()
      .from(projects)
      .where(eq(projects.businessId, biz[0].id))
      .limit(1);

    if (proj.length === 0) {
      return NextResponse.json({ onboarded: false, metrics: null });
    }

    const projectId = proj[0].id;

    // 3. Aggregate metrics for this project and environment
    // Confirmed volume sum
    const volumeResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${orders.amountMinor}), 0)::integer`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.projectId, projectId),
          eq(orders.environment, environment),
          eq(orders.status, 'confirmed')
        )
      );

    const totalVolumeMinor = volumeResult[0]?.total ?? 0;

    // Confirmed count
    const confirmedCountResult = await db
      .select({
        count: sql<number>`COUNT(*)::integer`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.projectId, projectId),
          eq(orders.environment, environment),
          eq(orders.status, 'confirmed')
        )
      );

    const confirmedCount = confirmedCountResult[0]?.count ?? 0;

    // Pending count
    const pendingCountResult = await db
      .select({
        count: sql<number>`COUNT(*)::integer`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.projectId, projectId),
          eq(orders.environment, environment),
          eq(orders.status, 'confirmation_pending')
        )
      );

    const pendingCount = pendingCountResult[0]?.count ?? 0;

    // Recent payments (limit 5)
    const recentPayments = await db
      .select({
        id: orders.publicId,
        amountMinor: orders.amountMinor,
        currency: orders.currency,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.projectId, projectId), eq(orders.environment, environment)))
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(5);

    return NextResponse.json({
      onboarded: true,
      metrics: {
        confirmedVolume: totalVolumeMinor / 100, // Format as major currency units
        confirmedCount,
        pendingCount,
      },
      recentPayments,
    });
  } catch (error) {
    console.error('Failed to load dashboard metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
