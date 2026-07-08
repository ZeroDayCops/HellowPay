/**
 * HollowPay — API Keys Revocation API
 *
 * DELETE /api/dashboard/api-keys/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, apiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: keyIdStr } = await params;
  const keyId = parseInt(keyIdStr, 10);

  if (isNaN(keyId)) {
    return NextResponse.json({ error: 'Invalid API key identifier.' }, { status: 400 });
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

    // 2. Revoke key
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.projectId, projectId)
        )
      )
      .limit(1);

    if (!keyRecord) {
      return NextResponse.json({ error: 'API key not found in this project scope.' }, { status: 404 });
    }

    await db
      .update(apiKeys)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId));

    return NextResponse.json({ success: true, message: 'API key successfully revoked.' });
  } catch (error: unknown) {
    console.error('Failed to revoke API key:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
