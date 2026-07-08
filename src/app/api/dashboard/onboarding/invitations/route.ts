/**
 * HollowPay — Onboarding Invitations Query & Accept API
 *
 * GET  /api/dashboard/onboarding/invitations — Checks pending invitations for email
 * POST /api/dashboard/onboarding/invitations — Accepts a pending invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { workspaceInvitations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  getPendingInvitationsForEmail,
  acceptWorkspaceInvitation,
} from '@/lib/services/team.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  const user = await currentUser();

  if (!clerkUserId || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ success: true, invitations: [] });
  }

  try {
    const list = await getPendingInvitationsForEmail(email);
    return NextResponse.json({
      success: true,
      invitations: list,
    });
  } catch (error: unknown) {
    console.error('Failed to query pending invitations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  const user = await currentUser();

  if (!clerkUserId || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { inviteId: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { inviteId } = body;
  if (inviteId === undefined) {
    return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
  }

  try {
    // 1. Double check invitation exists and matches email
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: 'User email not found.' }, { status: 400 });
    }

    const invites = await db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, inviteId))
      .limit(1);

    if (invites.length === 0) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    if (invites[0].email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Invitation email mismatch.' }, { status: 403 });
    }

    // 2. Accept and join
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Team Member';
    await acceptWorkspaceInvitation(inviteId, clerkUserId, name);

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully.',
    });
  } catch (error: unknown) {
    console.error('Failed to accept invitation:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
