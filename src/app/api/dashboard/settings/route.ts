/**
 * HollowPay — General Project Settings Dashboard API
 *
 * GET  /api/dashboard/settings — Retrieves project configurations and modes
 * POST /api/dashboard/settings — Modifies active environments flags and project name
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, liveModeApplications } from '@/lib/db/schema';
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

    const projList = await db
      .select()
      .from(projects)
      .where(eq(projects.businessId, biz[0].id))
      .limit(1);

    if (projList.length === 0) {
      return NextResponse.json({ error: 'Project not configured' }, { status: 404 });
    }

    return NextResponse.json({ project: projList[0] });
  } catch (error: unknown) {
    console.error('Failed to retrieve project settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    name: string;
    test_mode?: boolean;
    live_mode?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { name, test_mode, live_mode } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
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

    const projList = await db
      .select()
      .from(projects)
      .where(eq(projects.businessId, biz[0].id))
      .limit(1);

    if (projList.length === 0) {
      return NextResponse.json({ error: 'Project not configured' }, { status: 404 });
    }

    const project = projList[0];

    // 2. Enforce Live Mode verification gating
    let finalLiveMode = project.liveModeEnabled;
    if (live_mode === true && !project.liveModeEnabled) {
      // Query if an approved application exists
      const apps = await db
        .select()
        .from(liveModeApplications)
        .where(
          and(
            eq(liveModeApplications.projectId, project.id),
            eq(liveModeApplications.status, 'approved')
          )
        )
        .limit(1);

      if (apps.length === 0) {
        return NextResponse.json(
          { error: 'Live Mode is blocked. Requires admin compliance verification.' },
          { status: 400 }
        );
      }
      finalLiveMode = true;
    } else if (live_mode === false) {
      finalLiveMode = false;
    }

    // 3. Update project configs
    const [updatedProj] = await db
      .update(projects)
      .set({
        name: name.trim(),
        testModeEnabled: test_mode !== undefined ? test_mode : project.testModeEnabled,
        liveModeEnabled: finalLiveMode,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning();

    return NextResponse.json({ success: true, project: updatedProj });
  } catch (error: unknown) {
    console.error('Failed to update project settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
