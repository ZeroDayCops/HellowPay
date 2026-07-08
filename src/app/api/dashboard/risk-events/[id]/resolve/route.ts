/**
 * HollowPay — Risk Event Resolution API
 *
 * POST /api/dashboard/risk-events/[id]/resolve
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, riskEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventIdStr } = await params;
  const eventId = parseInt(eventIdStr, 10);

  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'Invalid risk event ID.' }, { status: 400 });
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

    // 2. Mark resolved
    const result = await db
      .update(riskEvents)
      .set({
        resolvedAt: new Date(),
        resolvedBy: profile[0].id,
      })
      .where(
        and(
          eq(riskEvents.id, eventId),
          eq(riskEvents.projectId, projectId)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Risk event not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Risk event marked as resolved successfully.',
    });
  } catch (error: unknown) {
    console.error('Failed to resolve risk event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
