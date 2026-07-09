/**
 * HollowPay — Notification Service
 *
 * Manages in-app notifications, trigger dispatches for merchants/founders,
 * unread counters, and mark-as-read updates.
 */

import { db } from '@/lib/db';
import {
  notifications,
  userProfiles,
  workspaceMembers,
  businesses,
  projects,
  notificationPreferences,
} from '@/lib/db/schema';
import { eq, and, isNull, desc, or, inArray } from 'drizzle-orm';
import { generatePublicId } from '@/lib/crypto/id-generator';
import { SUPERADMIN_EMAILS } from '@/lib/auth/admin';

export interface CreateNotificationParams {
  userId: number;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Creates a single notification record for a user.
 * Respects user preferences in notification_preferences.
 */
export async function createNotification(params: CreateNotificationParams) {
  // Check if user has disabled this notification type for the 'in_app' channel
  const pref = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, params.userId),
        eq(notificationPreferences.notificationType, params.type),
        eq(notificationPreferences.channel, 'in_app')
      )
    )
    .limit(1);

  if (pref.length > 0 && !pref[0].enabled) {
    // User has opted out of this alert channel/type.
    return null;
  }

  const publicId = generatePublicId('notification');
  const [notif] = await db
    .insert(notifications)
    .values({
      publicId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body || null,
      link: params.link || null,
    })
    .returning();
  return notif;
}

/**
 * Sends a notification to all members of a project's workspace.
 */
export async function sendMerchantNotification(
  projectId: number,
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  try {
    // 1. Resolve workspaceId from project -> business
    const result = await db
      .select({ workspaceId: businesses.workspaceId })
      .from(projects)
      .innerJoin(businesses, eq(projects.businessId, businesses.id))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (result.length === 0) return;

    const { workspaceId } = result[0];

    // 2. Fetch all members of the workspace
    const members = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    // 3. Create a notification for each member
    await Promise.all(
      members.map((member) =>
        createNotification({
          userId: member.userId,
          type,
          title,
          body,
          link,
        })
      )
    );
  } catch (error) {
    console.error('Failed to send merchant notification:', error);
  }
}

/**
 * Sends a notification to all platform administrators (Founders).
 */
export async function sendFounderNotification(
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  try {
    // Fetch all admins (isAdmin=true OR email in superadmin list)
    const admins = await db
      .select()
      .from(userProfiles)
      .where(
        or(
          eq(userProfiles.isAdmin, true),
          inArray(userProfiles.email, [...SUPERADMIN_EMAILS])
        )
      );

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type,
          title,
          body,
          link,
        })
      )
    );
  } catch (error) {
    console.error('Failed to send founder notification:', error);
  }
}

/**
 * Gets the number of unread notifications for a user.
 */
export async function getUnreadCount(userId: number): Promise<number> {
  const result = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );
  return result.length;
}

/**
 * Gets a paginated list of notifications for a user.
 */
export async function getNotificationList(
  userId: number,
  limit = 20,
  offset = 0
) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Marks a single notification as read.
 */
export async function markAsRead(notificationId: number, userId: number) {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
    .returning();
  return updated;
}

/**
 * Marks all of a user's notifications as read.
 */
export async function markAllAsRead(userId: number) {
  return db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    )
    .returning();
}

/**
 * Gets a user's notification preferences
 */
export async function getNotificationPreferences(userId: number) {
  return db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
}

/**
 * Upserts a user's notification preference configuration
 */
export async function updateNotificationPreference(
  userId: number,
  notificationType: string,
  channel: 'in_app' | 'email',
  enabled: boolean
) {
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, notificationType),
        eq(notificationPreferences.channel, channel)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({ enabled })
      .where(eq(notificationPreferences.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(notificationPreferences)
      .values({
        userId,
        notificationType,
        channel,
        enabled,
      })
      .returning();
    return inserted;
  }
}

