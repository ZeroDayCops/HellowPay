/**
 * HollowPay — Settings Live Mode Application API
 *
 * GET  /api/dashboard/settings/live-application — Fetch project's Live Mode application status
 * POST /api/dashboard/settings/live-application — Submit project's Live Mode activation request
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  userProfiles,
  workspaceMembers,
  businesses,
  projects,
  liveModeApplications,
  auditLogs,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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

    const project = projList[0];

    // 2. Fetch the latest live mode application for project
    const apps = await db
      .select()
      .from(liveModeApplications)
      .where(eq(liveModeApplications.projectId, project.id))
      .orderBy(desc(liveModeApplications.id))
      .limit(1);

    if (apps.length === 0) {
      return NextResponse.json({ application: { status: 'not_requested' } });
    }

    return NextResponse.json({ application: apps[0] });
  } catch (error: unknown) {
    console.error('Failed to retrieve live mode application:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const project = projList[0];

    // 2. Fetch the latest live mode application to check state
    const apps = await db
      .select()
      .from(liveModeApplications)
      .where(eq(liveModeApplications.projectId, project.id))
      .orderBy(desc(liveModeApplications.id))
      .limit(1);

    const latestApp = apps[0];

    if (latestApp && (latestApp.status === 'pending_review' || latestApp.status === 'approved')) {
      return NextResponse.json(
        { error: `Cannot submit a new request. An active application with status '${latestApp.status}' already exists.` },
        { status: 400 }
      );
    }

    // 3. Create a new Live Mode Application
    const [newApp] = await db
      .insert(liveModeApplications)
      .values({
        projectId: project.id,
        status: 'pending_review',
        requestedAt: new Date(),
        requestedBy: profile[0].id,
      })
      .returning();

    // 4. Create an immutable audit log entry
    await db.insert(auditLogs).values({
      publicId: `aud_hp_${nanoid(16)}`,
      workspaceId: membership[0].workspaceId,
      actorId: profile[0].id,
      action: 'live_mode_requested',
      targetType: 'project',
      targetId: String(project.id),
      metadata: {
        applicationId: newApp.id,
        projectName: project.name,
      },
    });

    return NextResponse.json({ success: true, application: newApp });
  } catch (error: unknown) {
    console.error('Failed to request live mode:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
