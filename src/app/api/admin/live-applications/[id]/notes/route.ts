/**
 * HollowPay — Administrative Notes API on Compliance Applications
 *
 * GET  /api/admin/live-applications/[id]/notes — Lists notes for an application
 * POST /api/admin/live-applications/[id]/notes — Appends a new compliance annotation note
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminNotes, createAdminNote } from '@/lib/services/admin-note.service';

async function checkAdminPrivilege(clerkUserId: string): Promise<any> {
  const profile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, clerkUserId))
    .limit(1);

  if (profile.length === 0) return null;
  const isSuper = profile[0].isAdmin || profile[0].email === 'zerodaycops@gmail.com';
  return isSuper ? profile[0] : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminProfile = await checkAdminPrivilege(clerkUserId);
  if (!adminProfile) {
    return NextResponse.json({ error: 'Permission denied. Founder account required.' }, { status: 403 });
  }

  const { id: appId } = await params;

  try {
    const notes = await getAdminNotes('live_application', appId);
    return NextResponse.json({ success: true, notes });
  } catch (error: unknown) {
    console.error('Failed to retrieve compliance application notes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminProfile = await checkAdminPrivilege(clerkUserId);
  if (!adminProfile) {
    return NextResponse.json({ error: 'Permission denied. Founder account required.' }, { status: 403 });
  }

  const { id: appId } = await params;

  let body: { content: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { content } = body;

  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Note content cannot be empty.' }, { status: 400 });
  }

  try {
    const note = await createAdminNote({
      targetType: 'live_application',
      targetId: appId,
      authorId: adminProfile.id,
      content: content.trim(),
    });

    return NextResponse.json({ success: true, note });
  } catch (error: unknown) {
    console.error('Failed to append compliance application note:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
