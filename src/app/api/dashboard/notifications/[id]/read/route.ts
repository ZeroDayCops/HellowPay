/**
 * HollowPay — Notification Read Action API
 *
 * POST /api/dashboard/notifications/[id]/read
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { markAsRead } from '@/lib/services/notification.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const notificationId = parseInt(resolvedParams.id, 10);

  if (isNaN(notificationId)) {
    return NextResponse.json({ error: 'Invalid notification ID.' }, { status: 400 });
  }

  try {
    // Resolve user profile
    const profileResult = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profileResult.length === 0) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const profile = profileResult[0];

    // Mark specific notification as read
    const updated = await markAsRead(notificationId, profile.id);

    if (!updated) {
      return NextResponse.json({ error: 'Notification not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to mark notification as read:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
