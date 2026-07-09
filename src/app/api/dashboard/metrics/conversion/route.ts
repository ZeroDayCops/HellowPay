/**
 * HollowPay — Checkout Conversion Metrics API
 *
 * GET /api/dashboard/metrics/conversion
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, checkoutSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      return NextResponse.json({ error: 'Workspace membership not found' }, { status: 404 });
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
    const environment = proj[0].testModeEnabled ? 'test' : 'live';

    // 2. Fetch checkout sessions count by status
    const sessions = await db
      .select({
        status: checkoutSessions.status,
      })
      .from(checkoutSessions)
      .where(
        and(
          eq(checkoutSessions.projectId, projectId),
          eq(checkoutSessions.environment, environment)
        )
      );

    let total = sessions.length;
    let completed = 0;
    let expired = 0;
    let open = 0;

    sessions.forEach((s) => {
      if (s.status === 'completed') completed++;
      else if (s.status === 'expired') expired++;
      else open++;
    });

    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const abandonmentRate = total > 0 ? Math.round((expired / total) * 100) : 0;

    return NextResponse.json({
      metrics: {
        totalSessions: total,
        completedSessions: completed,
        expiredSessions: expired,
        openSessions: open,
        conversionRate,
        abandonmentRate,
      }
    });
  } catch (error: unknown) {
    console.error('Failed to query conversion telemetry metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
