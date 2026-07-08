/**
 * HollowPay — Workspace Team Query & Invite API
 *
 * GET  /api/dashboard/settings/team — Lists active members and invitations
 * POST /api/dashboard/settings/team — Issues a new team invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  getWorkspaceMembers,
  getWorkspaceInvitations,
  inviteMember,
} from '@/lib/services/team.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Resolve user profile and workspace
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

    // 2. Fetch list
    const members = await getWorkspaceMembers(workspaceId);
    const invitations = await getWorkspaceInvitations(workspaceId);

    // Find current user's role in this workspace
    const currentUserRole = membership[0].role;

    return NextResponse.json({
      success: true,
      members,
      invitations,
      currentUserRole,
    });
  } catch (error: unknown) {
    console.error('Failed to retrieve team details:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email: string; role: 'admin' | 'developer' | 'viewer' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { email, role } = body;

  if (!email || !role) {
    return NextResponse.json({ error: 'Email address and role selection are required.' }, { status: 400 });
  }

  if (!['admin', 'developer', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid workspace role selection.' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email address format.' }, { status: 400 });
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

    // 2. Guard: Only owners and admins can invite new members
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      return NextResponse.json({ error: 'Permission denied. Only Owners and Admins can invite team members.' }, { status: 403 });
    }

    // 3. Issue invitation
    const invitation = await inviteMember(workspaceId, email, role, profile[0].id);

    return NextResponse.json({
      success: true,
      invitation,
    });
  } catch (error: unknown) {
    console.error('Failed to invite team member:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
