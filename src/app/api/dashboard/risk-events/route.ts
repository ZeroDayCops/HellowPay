/**
 * HollowPay — Risk Events API
 *
 * GET /api/dashboard/risk-events
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, riskEvents } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

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

    // 2. Fetch risk events
    const list = await db
      .select({
        id: riskEvents.id,
        projectId: riskEvents.projectId,
        type: riskEvents.type,
        severity: riskEvents.severity,
        details: riskEvents.details,
        resolvedAt: riskEvents.resolvedAt,
        resolvedBy: riskEvents.resolvedBy,
        createdAt: riskEvents.createdAt,
        resolverName: userProfiles.name,
        resolverEmail: userProfiles.email,
      })
      .from(riskEvents)
      .leftJoin(userProfiles, eq(riskEvents.resolvedBy, userProfiles.id))
      .where(eq(riskEvents.projectId, projectId))
      .orderBy(desc(riskEvents.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalCountResult = await db
      .select({ id: riskEvents.id })
      .from(riskEvents)
      .where(eq(riskEvents.projectId, projectId));

    return NextResponse.json({
      success: true,
      events: list,
      totalCount: totalCountResult.length,
    });
  } catch (error: unknown) {
    console.error('Failed to list risk events:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
