/**
 * HollowPay — User Notification Preferences API
 *
 * GET  /api/dashboard/settings/notifications — Retrieve user preferences
 * POST /api/dashboard/settings/notifications — Update toggled preference settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/lib/services/notification.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const prefs = await getNotificationPreferences(profile[0].id);

    return NextResponse.json({ success: true, preferences: prefs });
  } catch (error: unknown) {
    console.error('Failed to retrieve notification preferences:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    notificationType: string;
    channel: 'in_app' | 'email';
    enabled: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { notificationType, channel, enabled } = body;

  if (!notificationType || !channel || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing required configuration parameters.' }, { status: 400 });
  }

  if (channel !== 'in_app' && channel !== 'email') {
    return NextResponse.json({ error: 'Invalid delivery channel.' }, { status: 400 });
  }

  try {
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const pref = await updateNotificationPreference(
      profile[0].id,
      notificationType,
      channel,
      enabled
    );

    return NextResponse.json({ success: true, preference: pref });
  } catch (error: unknown) {
    console.error('Failed to update notification preferences:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
