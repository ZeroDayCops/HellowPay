/**
 * HollowPay — Administrative Notes Service
 */

import { db } from '@/lib/db';
import { adminNotes, userProfiles } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface AdminNoteData {
  targetType: string;
  targetId: string;
  authorId: number;
  content: string;
}

/**
 * Creates an administrative annotation note
 */
export async function createAdminNote(data: AdminNoteData): Promise<any> {
  const [note] = await db
    .insert(adminNotes)
    .values({
      targetType: data.targetType,
      targetId: data.targetId,
      authorId: data.authorId,
      content: data.content.trim(),
    })
    .returning();

  return note;
}

/**
 * Fetch timeline of notes on a target record (e.g. live applications)
 */
export async function getAdminNotes(
  targetType: string,
  targetId: string
): Promise<any[]> {
  return db
    .select({
      id: adminNotes.id,
      targetType: adminNotes.targetType,
      targetId: adminNotes.targetId,
      content: adminNotes.content,
      createdAt: adminNotes.createdAt,
      authorName: userProfiles.name,
      authorEmail: userProfiles.email,
    })
    .from(adminNotes)
    .innerJoin(userProfiles, eq(adminNotes.authorId, userProfiles.id))
    .where(
      and(
        eq(adminNotes.targetType, targetType),
        eq(adminNotes.targetId, targetId)
      )
    )
    .orderBy(desc(adminNotes.createdAt));
}
