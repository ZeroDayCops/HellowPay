/**
 * HollowPay — Developer API Request Logs Dashboard API
 *
 * GET /api/dashboard/api-logs — Lists transaction request logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, apiRequestLogs } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  try {
    // 1. Resolve project context
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

    // 2. Fetch API logs from DB
    const logs = await db
      .select()
      .from(apiRequestLogs)
      .where(
        and(
          eq(apiRequestLogs.projectId, projectId),
          eq(apiRequestLogs.environment, environment)
        )
      )
      .orderBy(desc(apiRequestLogs.createdAt))
      .limit(limit);

    return NextResponse.json({ logs });
  } catch (error: unknown) {
    console.error('Failed to list API request logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
