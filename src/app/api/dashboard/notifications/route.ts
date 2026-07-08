/**
 * HollowPay — Notifications list & Read-all API
 *
 * GET /api/dashboard/notifications
 * POST /api/dashboard/notifications/read-all
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  getNotificationList,
  getUnreadCount,
  markAllAsRead,
} from '@/lib/services/notification.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Resolve user profile
    const profileResult = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profileResult.length === 0) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const profile = profileResult[0];

    // 2. Fetch notifications list & count unread
    const list = await getNotificationList(profile.id, 20);
    const unreadCount = await getUnreadCount(profile.id);

    return NextResponse.json({
      notifications: list,
      unreadCount,
    });
  } catch (error: unknown) {
    console.error('Failed to get notifications:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Mark all as read
    await markAllAsRead(profile.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to mark all notifications as read:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
