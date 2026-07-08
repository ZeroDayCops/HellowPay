/**
 * HollowPay — Team Revocation API
 *
 * POST /api/dashboard/settings/team/revoke
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  revokeInvitation,
  removeWorkspaceMember,
} from '@/lib/services/team.service';

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { type: 'invite' | 'member'; id: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { type, id } = body;

  if (!type || id === undefined) {
    return NextResponse.json({ error: 'Revocation target type and ID are required.' }, { status: 400 });
  }

  if (type !== 'invite' && type !== 'member') {
    return NextResponse.json({ error: 'Invalid target type. Must be invite or member.' }, { status: 400 });
  }

  try {
    // 1. Resolve user profile and caller membership
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

    const workspaceId = membership[0].workspaceId;
    const callerRole = membership[0].role;

    // 2. Guard: Only owners and admins can revoke invites or members
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      return NextResponse.json({ error: 'Permission denied. Only Owners and Admins can manage team membership.' }, { status: 403 });
    }

    // 3. Execute revocation
    if (type === 'invite') {
      const success = await revokeInvitation(id, workspaceId);
      if (!success) {
        return NextResponse.json({ error: 'Invitation not found or expired.' }, { status: 404 });
      }
    } else {
      // Guard: Cannot remove yourself
      if (id === membership[0].id) {
        return NextResponse.json({ error: 'You cannot remove yourself from the workspace. Use leave instead.' }, { status: 400 });
      }
      
      const success = await removeWorkspaceMember(id, workspaceId);
      if (!success) {
        return NextResponse.json({ error: 'Workspace member not found.' }, { status: 404 });
      }
    }

    return NextResponse.json({
      success: true,
      message: type === 'invite' ? 'Invitation revoked successfully.' : 'Workspace member removed successfully.',
    });
  } catch (error: unknown) {
    console.error('Failed to revoke team member/invite:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
