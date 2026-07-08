/**
 * HollowPay — Admin Live Mode Applications API
 *
 * GET /api/admin/live-applications — List live mode activation requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  userProfiles,
  liveModeApplications,
  projects,
  businesses,
} from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Resolve user profile
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const user = profile[0];

    // 2. Role Gate: Enforce admin status
    const isAdmin = user.isAdmin || user.email === 'zerodaycops@gmail.com';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied: Requires administrator privilege.' }, { status: 403 });
    }

    // 3. Fetch applications with project & business details
    const applications = await db
      .select({
        applicationId: liveModeApplications.id,
        status: liveModeApplications.status,
        requestedAt: liveModeApplications.requestedAt,
        reviewedAt: liveModeApplications.reviewedAt,
        reviewReason: liveModeApplications.reviewReason,
        projectName: projects.name,
        projectPublicId: projects.publicId,
        businessName: businesses.name,
        businessEmail: businesses.supportEmail,
        applicantName: userProfiles.name,
        applicantEmail: userProfiles.email,
      })
      .from(liveModeApplications)
      .innerJoin(projects, eq(liveModeApplications.projectId, projects.id))
      .innerJoin(businesses, eq(projects.businessId, businesses.id))
      .leftJoin(userProfiles, eq(liveModeApplications.requestedBy, userProfiles.id))
      .orderBy(desc(liveModeApplications.id))
      .limit(100);

    return NextResponse.json({ applications });
  } catch (error: unknown) {
    console.error('Failed to list live mode applications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
