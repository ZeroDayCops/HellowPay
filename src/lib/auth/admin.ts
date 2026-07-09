/**
 * HollowPay — Centralized Admin Privilege Configuration
 *
 * Defines which emails have superadmin access to the platform.
 * Used across all admin API routes and the admin dashboard guard.
 * Auto-provisions user profiles for superadmin emails on first access.
 */

import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { currentUser } from '@clerk/nextjs/server';
import { generatePublicId } from '@/lib/crypto/id-generator';

/**
 * Emails with unconditional superadmin access, regardless of DB `isAdmin` flag.
 * These are platform founders/operators.
 */
export const SUPERADMIN_EMAILS: readonly string[] = [
  'zerodaycops@gmail.com',
  'karanvaniya364@gmail.com',
];

/**
 * Ensures a user profile exists in the DB for the given Clerk user.
 * If the user is a superadmin email without a profile, auto-creates one.
 */
async function ensureProfileExists(clerkUserId: string) {
  // Check if profile already exists
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, clerkUserId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Profile missing — check Clerk for user details
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';

    // Only auto-provision for superadmin emails
    if (!SUPERADMIN_EMAILS.includes(email)) return null;

    const name = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || 'Admin';

    const [newProfile] = await db
      .insert(userProfiles)
      .values({
        publicId: generatePublicId('user'),
        clerkUserId,
        email,
        name,
        isAdmin: true,
      })
      .returning();

    console.log(`[Admin] Auto-provisioned superadmin profile for ${email}`);
    return newProfile;
  } catch (err) {
    console.error('[Admin] Failed to auto-provision profile:', err);
    return null;
  }
}

/**
 * Checks whether a Clerk user has admin/superadmin privileges.
 * Auto-provisions profile for superadmin emails if needed.
 */
export async function checkAdminPrivilege(clerkUserId: string): Promise<boolean> {
  const profile = await ensureProfileExists(clerkUserId);
  if (!profile) return false;
  return profile.isAdmin || SUPERADMIN_EMAILS.includes(profile.email);
}

/**
 * Returns the user profile row for a Clerk user, or null if not found.
 * Auto-provisions profile for superadmin emails if needed.
 */
export async function getAdminProfile(clerkUserId: string) {
  const profile = await ensureProfileExists(clerkUserId);
  if (!profile) return null;
  const isAdmin = profile.isAdmin || SUPERADMIN_EMAILS.includes(profile.email);
  return { ...profile, isAdmin };
}
