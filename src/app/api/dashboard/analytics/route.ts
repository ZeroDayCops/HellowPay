/**
 * HollowPay — Analytics Report API
 *
 * GET /api/dashboard/analytics — Aggregates daily transaction metrics and volumes over pre-selected date intervals.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, paymentAttempts, paymentClaims, customers } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';
  const range = searchParams.get('range') || '30'; // defaults to 30 days
  const daysLimit = parseInt(range, 10);

  try {
    // 1. Resolve project contexts
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

    const biz = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, membership[0].workspaceId))
      .limit(1);

    if (biz.length === 0) {
      return NextResponse.json({ error: 'Business settings not found' }, { status: 404 });
    }

    const proj = await db
      .select()
      .from(projects)
      .where(eq(projects.businessId, biz[0].id))
      .limit(1);

    if (proj.length === 0) {
      return NextResponse.json({ error: 'Project not configured' }, { status: 404 });
    }

    const projectId = proj[0].id;

    // 2. Fetch daily aggregated volume & counts
    // For PostgreSQL, we group by date_trunc('day', created_at)
    const dailyData = await db
      .select({
        day: sql<string>`to_char(${paymentAttempts.createdAt}, 'YYYY-MM-DD')`,
        volume: sql<number>`coalesce(sum(case when ${paymentAttempts.status} = 'confirmed' or ${paymentAttempts.status} = 'paid' then ${paymentAttempts.amountMinor} else 0 end), 0)`.mapWith(Number),
        count: sql<number>`count(case when ${paymentAttempts.status} = 'confirmed' or ${paymentAttempts.status} = 'paid' then 1 else null end)`.mapWith(Number),
      })
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.projectId, projectId),
          eq(paymentAttempts.environment, environment),
          sql`${paymentAttempts.createdAt} >= now() - interval '${sql.raw(String(daysLimit))} days'`
        )
      )
      .groupBy(sql`to_char(${paymentAttempts.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${paymentAttempts.createdAt}, 'YYYY-MM-DD')`);

    // 3. Fetch summary metrics
    // Total Volume
    const totalVolumeResult = await db
      .select({
        totalVolume: sql<number>`coalesce(sum(${paymentAttempts.amountMinor}), 0)`.mapWith(Number),
        confirmedCount: sql<number>`count(case when ${paymentAttempts.status} = 'confirmed' or ${paymentAttempts.status} = 'paid' then 1 else null end)`.mapWith(Number),
      })
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.projectId, projectId),
          eq(paymentAttempts.environment, environment),
          eq(paymentAttempts.status, 'confirmed'),
          sql`${paymentAttempts.createdAt} >= now() - interval '${sql.raw(String(daysLimit))} days'`
        )
      );

    const { totalVolume, confirmedCount } = totalVolumeResult[0] || { totalVolume: 0, confirmedCount: 0 };

    // Claims statistics
    const claimsStatsResult = await db
      .select({
        total: sql<number>`count(${paymentClaims.id})`.mapWith(Number),
        approved: sql<number>`count(case when ${paymentClaims.status} = 'approved' then 1 else null end)`.mapWith(Number),
        rejected: sql<number>`count(case when ${paymentClaims.status} = 'rejected' then 1 else null end)`.mapWith(Number),
      })
      .from(paymentClaims)
      .where(
        and(
          eq(paymentClaims.projectId, projectId),
          sql`${paymentClaims.createdAt} >= now() - interval '${sql.raw(String(daysLimit))} days'`
        )
      );

    const claimsStats = claimsStatsResult[0] || { total: 0, approved: 0, rejected: 0 };

    // Active customers in past N days
    const activeCustomersResult = await db
      .select({
        count: sql<number>`count(distinct ${customers.id})`.mapWith(Number),
      })
      .from(customers)
      .innerJoin(paymentAttempts, eq(paymentAttempts.projectId, customers.projectId))
      .where(
        and(
          eq(customers.projectId, projectId),
          eq(paymentAttempts.environment, environment),
          sql`${paymentAttempts.createdAt} >= now() - interval '${sql.raw(String(daysLimit))} days'`
        )
      );

    const activeCustomers = activeCustomersResult[0]?.count || 0;

    // Build day-by-day maps to fill dates with zero volume (for smooth chart rendering)
    const statsMap = new Map<string, { volume: number; count: number }>();
    dailyData.forEach((row) => {
      statsMap.set(row.day, { volume: row.volume, count: row.count });
    });

    const filledStats: { day: string; volume: number; count: number }[] = [];
    const dateCursor = new Date();
    dateCursor.setDate(dateCursor.getDate() - daysLimit + 1);

    for (let i = 0; i < daysLimit; i++) {
      const dateStr = dateCursor.toISOString().split('T')[0];
      const match = statsMap.get(dateStr);
      filledStats.push({
        day: dateStr,
        volume: match ? match.volume : 0,
        count: match ? match.count : 0,
      });
      dateCursor.setDate(dateCursor.getDate() + 1);
    }

    return NextResponse.json({
      summary: {
        totalVolume,
        confirmedCount,
        averageTicketValue: confirmedCount > 0 ? Math.round(totalVolume / confirmedCount) : 0,
        activeCustomers,
        claims: claimsStats,
      },
      stats: filledStats,
    });
  } catch (error: unknown) {
    console.error('Failed to calculate analytics metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
