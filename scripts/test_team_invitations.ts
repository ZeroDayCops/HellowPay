/**
 * HollowPay — Phase 19 Workspace Team Management & Invitations Tests
 *
 * Verifies:
 * 1. Team invitation creation and secure token generation.
 * 2. Retrieval of pending invitations and active members lists.
 * 3. Token acceptance and automatic workspace membership enrollment.
 * 4. Revocation of active memberships and pending invitation tokens.
 */

import fs from 'fs';
import path from 'path';

// Bootstrap environment variables
const envPath = fs.existsSync(path.resolve('./.env.local'))
  ? path.resolve('./.env.local')
  : path.resolve('./.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

async function runTests() {
  console.log('🧪 Starting Phase 19 Workspace Team & Invitations Tests...');

  const { db } = await import('../src/lib/db');
  const { userProfiles, workspaceMembers, workspaceInvitations, workspaces } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const {
    getWorkspaceMembers,
    getWorkspaceInvitations,
    inviteMember,
    revokeInvitation,
    removeWorkspaceMember,
    getPendingInvitationsForEmail,
    acceptWorkspaceInvitation,
  } = await import('../src/lib/services/team.service');

  try {
    // 1. Resolve seed user and workspace
    const userList = await db.select().from(userProfiles).limit(1);
    if (userList.length === 0) {
      throw new Error('No user profile found. Seed first.');
    }
    const testUser = userList[0];
    console.log(`Found test user: ${testUser.name} (ID: ${testUser.id})`);

    const memberList = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, testUser.id))
      .limit(1);

    if (memberList.length === 0) {
      throw new Error('No workspace membership found.');
    }
    const workspaceId = memberList[0].workspaceId;

    // Clean up any existing invitations for this email to have a clean count
    const inviteeEmail = 'test-invitee@cops.local';
    console.log('Cleaning up existing mock invitations...');
    await db.delete(workspaceInvitations).where(eq(workspaceInvitations.email, inviteeEmail));

    // 2. Test inviteMember
    console.log('\nStep 1: Testing inviteMember...');
    const invite = await inviteMember(workspaceId, inviteeEmail, 'developer', testUser.id);
    console.log(`- Created invitation with ID: ${invite.id}`);
    if (invite.status !== 'pending') {
      throw new Error(`Expected invitation status to be pending, got: ${invite.status}`);
    }

    // 3. Test getWorkspaceInvitations
    console.log('\nStep 2: Checking pending invitations list...');
    const activeInvites = await getWorkspaceInvitations(workspaceId);
    console.log(`- Pending invitations count: ${activeInvites.length}`);
    const foundInvite = activeInvites.find((i) => i.email === inviteeEmail);
    if (!foundInvite) {
      throw new Error('Expected created invitation to be in pending list.');
    }

    // 4. Test getPendingInvitationsForEmail
    console.log('\nStep 3: Checking pending invitations by email...');
    const emailInvites = await getPendingInvitationsForEmail(inviteeEmail);
    console.log(`- Pending invitations by email count: ${emailInvites.length}`);
    if (emailInvites.length !== 1) {
      throw new Error(`Expected exactly 1 invitation for ${inviteeEmail}, got: ${emailInvites.length}`);
    }

    // 5. Test acceptWorkspaceInvitation
    console.log('\nStep 4: Testing invitation acceptance flow...');
    const mockClerkId = 'user_clerk_invite_test';
    const mockName = 'Mock Developer Team Member';

    // Delete any existing mock user profile to avoid unique constraint collisions
    await db.delete(userProfiles).where(eq(userProfiles.clerkUserId, mockClerkId));

    const acceptResult = await acceptWorkspaceInvitation(invite.id, mockClerkId, mockName);
    console.log(`- Invitation accepted. New membership ID: ${acceptResult.membership.id}`);

    // Verify member was added to workspace
    const updatedMembers = await getWorkspaceMembers(workspaceId);
    console.log(`- Workspace members count: ${updatedMembers.length}`);
    const joinedMember = updatedMembers.find((m) => m.email === inviteeEmail);
    if (!joinedMember) {
      throw new Error('Expected new user to be in active members list.');
    }
    if (joinedMember.role !== 'developer') {
      throw new Error(`Expected joined role to be developer, got: ${joinedMember.role}`);
    }

    // Verify invitation is marked as accepted
    const checkInviteStatus = await db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invite.id))
      .limit(1);
    console.log(`- Updated invitation status: ${checkInviteStatus[0].status}`);
    if (checkInviteStatus[0].status !== 'accepted') {
      throw new Error(`Expected invite status to be accepted, got: ${checkInviteStatus[0].status}`);
    }

    // 6. Test removeWorkspaceMember
    console.log('\nStep 5: Testing workspace member removal...');
    const removeSuccess = await removeWorkspaceMember(acceptResult.membership.id, workspaceId);
    if (!removeSuccess) {
      throw new Error('Expected workspace member to be deleted.');
    }

    const postRemoveMembers = await getWorkspaceMembers(workspaceId);
    const stillExists = postRemoveMembers.some((m) => m.id === acceptResult.membership.id);
    console.log(`- Member exists in workspace after removal: ${stillExists}`);
    if (stillExists) {
      throw new Error('Expected deleted member to be removed from listing.');
    }

    // 7. Test invite revocation
    console.log('\nStep 6: Testing invitation revocation...');
    const invite2 = await inviteMember(workspaceId, inviteeEmail, 'viewer', testUser.id);
    console.log(`- Created second invitation with ID: ${invite2.id}`);
    
    const revokeSuccess = await revokeInvitation(invite2.id, workspaceId);
    if (!revokeSuccess) {
      throw new Error('Expected invitation token to be deleted.');
    }
    
    const postRevokeInvites = await getWorkspaceInvitations(workspaceId);
    const inviteExists = postRevokeInvites.some((i) => i.id === invite2.id);
    console.log(`- Invitation exists after revocation: ${inviteExists}`);
    if (inviteExists) {
      throw new Error('Expected deleted invitation token to be removed from listing.');
    }

    // Clean up test users and invites
    console.log('\nCleaning up workspace team test data...');
    await db.delete(userProfiles).where(eq(userProfiles.clerkUserId, mockClerkId));
    await db.delete(workspaceInvitations).where(eq(workspaceInvitations.email, inviteeEmail));

    console.log('\n🎉 ALL Phase 19 Workspace Team & Invitations tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Workspace Team Test failed:', error);
    process.exit(1);
  }
}

runTests();
