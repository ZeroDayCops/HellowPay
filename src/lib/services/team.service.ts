/**
 * HollowPay — Workspace Team & Invitations Service
 */

import { db } from '@/lib/db';
import {
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  userProfiles,
} from '@/lib/db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { generatePublicId } from '@/lib/crypto/id-generator';
import crypto from 'crypto';

export interface WorkspaceMemberInfo {
  id: number;
  userId: number;
  role: string;
  joinedAt: Date;
  name: string | null;
  email: string;
  publicId: string;
}

export interface PendingInviteInfo {
  id: number;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string | null;
  invitedByEmail: string | null;
}

/**
 * Get all members belonging to a workspace
 */
export async function getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMemberInfo[]> {
  const list = await db
    .select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt,
      name: userProfiles.name,
      email: userProfiles.email,
      publicId: userProfiles.publicId,
    })
    .from(workspaceMembers)
    .innerJoin(userProfiles, eq(workspaceMembers.userId, userProfiles.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(desc(workspaceMembers.createdAt));

  return list;
}

/**
 * Get all active pending invitations for a workspace
 */
export async function getWorkspaceInvitations(workspaceId: number): Promise<PendingInviteInfo[]> {
  const now = new Date();
  const list = await db
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      token: workspaceInvitations.token,
      expiresAt: workspaceInvitations.expiresAt,
      createdAt: workspaceInvitations.createdAt,
      invitedByName: userProfiles.name,
      invitedByEmail: userProfiles.email,
    })
    .from(workspaceInvitations)
    .leftJoin(userProfiles, eq(workspaceInvitations.invitedBy, userProfiles.id))
    .where(
      and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        eq(workspaceInvitations.status, 'pending'),
        gt(workspaceInvitations.expiresAt, now)
      )
    )
    .orderBy(desc(workspaceInvitations.createdAt));

  return list;
}

/**
 * Invite a member to the workspace
 */
export async function inviteMember(
  workspaceId: number,
  email: string,
  role: 'admin' | 'developer' | 'viewer',
  invitedByUserId: number
): Promise<any> {
  const trimmedEmail = email.trim().toLowerCase();

  // 1. Check if user already exists and is a member
  const existingMember = await db
    .select()
    .from(workspaceMembers)
    .innerJoin(userProfiles, eq(workspaceMembers.userId, userProfiles.id))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(userProfiles.email, trimmedEmail)
      )
    )
    .limit(1);

  if (existingMember.length > 0) {
    throw new Error('User is already a member of this workspace.');
  }

  // 2. Check if active pending invite already exists
  const now = new Date();
  const existingInvite = await db
    .select()
    .from(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        eq(workspaceInvitations.email, trimmedEmail),
        eq(workspaceInvitations.status, 'pending'),
        gt(workspaceInvitations.expiresAt, now)
      )
    )
    .limit(1);

  if (existingInvite.length > 0) {
    throw new Error('An active invitation is already pending for this email.');
  }

  // 3. Create invitation
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  const [invite] = await db
    .insert(workspaceInvitations)
    .values({
      workspaceId,
      email: trimmedEmail,
      role,
      token,
      status: 'pending',
      invitedBy: invitedByUserId,
      expiresAt,
    })
    .returning();

  return invite;
}

/**
 * Revoke an active invitation
 */
export async function revokeInvitation(inviteId: number, workspaceId: number): Promise<boolean> {
  const result = await db
    .delete(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.id, inviteId),
        eq(workspaceInvitations.workspaceId, workspaceId)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Remove a member from the workspace
 */
export async function removeWorkspaceMember(memberId: number, workspaceId: number): Promise<boolean> {
  // 1. Fetch member details
  const member = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.id, memberId),
        eq(workspaceMembers.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (member.length === 0) {
    throw new Error('Workspace member not found.');
  }

  // 2. Guard: Cannot remove the last workspace owner
  if (member[0].role === 'owner') {
    const owners = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.role, 'owner')
        )
      );

    if (owners.length <= 1) {
      throw new Error('Cannot remove the workspace owner. Transfer ownership first.');
    }
  }

  // 3. Remove
  const result = await db
    .delete(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId))
    .returning();

  return result.length > 0;
}

/**
 * Check if there is any active pending invitations for an email
 */
export async function getPendingInvitationsForEmail(email: string) {
  const now = new Date();
  return db
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      token: workspaceInvitations.token,
      workspaceName: workspaces.name,
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceInvitations.email, email.trim().toLowerCase()),
        eq(workspaceInvitations.status, 'pending'),
        gt(workspaceInvitations.expiresAt, now)
      )
    )
    .orderBy(desc(workspaceInvitations.createdAt));
}

/**
 * Accept a team invitation
 */
export async function acceptWorkspaceInvitation(
  inviteId: number,
  clerkUserId: string,
  name: string
): Promise<any> {
  return db.transaction(async (tx) => {
    const now = new Date();
    
    // 1. Fetch and validate invitation
    const invites = await tx
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.id, inviteId),
          eq(workspaceInvitations.status, 'pending'),
          gt(workspaceInvitations.expiresAt, now)
        )
      )
      .limit(1);

    if (invites.length === 0) {
      throw new Error('Invitation has expired or is invalid.');
    }

    const invite = invites[0];

    // 2. Ensure user profile exists
    const profiles = await tx
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    let profileId: number;

    if (profiles.length === 0) {
      const [newProfile] = await tx
        .insert(userProfiles)
        .values({
          publicId: generatePublicId('user'),
          clerkUserId,
          email: invite.email,
          name: name.trim() || 'Team Member',
          isAdmin: false,
        })
        .returning();
      profileId = newProfile.id;
    } else {
      profileId = profiles[0].id;
    }

    // 3. Insert workspace member
    const [membership] = await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: invite.workspaceId,
        userId: profileId,
        role: invite.role,
      })
      .returning();

    // 4. Update invite status
    await tx
      .update(workspaceInvitations)
      .set({ status: 'accepted' })
      .where(eq(workspaceInvitations.id, invite.id));

    return {
      membership,
      workspaceId: invite.workspaceId,
    };
  });
}
