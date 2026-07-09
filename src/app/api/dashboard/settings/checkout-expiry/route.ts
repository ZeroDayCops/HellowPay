/**
 * HollowPay — Checkout Session Expiry Settings API
 *
 * GET/POST /api/dashboard/settings/checkout-expiry
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getProjectSettings, updateProjectSettings } from '@/lib/services/project-settings.service';
import { createAuditLog } from '@/lib/services/audit.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    const settings = getProjectSettings(proj[0].publicId);
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    console.error('Failed to query project settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const expiry = Number(body.checkoutSessionExpiryMinutes);

    if (isNaN(expiry) || expiry < 5 || expiry > 1440) {
      return NextResponse.json(
        { error: 'Session expiration window must be between 5 and 1440 minutes (24 hours).' },
        { status: 400 }
      );
    }

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

    const updated = updateProjectSettings(proj[0].publicId, {
      checkoutSessionExpiryMinutes: expiry,
    });

    // Create Audit Log
    await createAuditLog({
      action: 'checkout_expiry_configured',
      targetType: 'project',
      targetId: proj[0].publicId,
      workspaceId: membership[0].workspaceId,
      userId: profile[0].id,
      metadata: {
        checkoutSessionExpiryMinutes: expiry,
      },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error: unknown) {
    console.error('Failed to update project settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
