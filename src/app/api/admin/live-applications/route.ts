/**
 * HollowPay — Admin Live Mode Applications API
 *
 * GET /api/admin/live-applications — List live mode activation requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  liveModeApplications,
  projects,
  businesses,
  userProfiles,
} from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { checkAdminPrivilege } from '@/lib/auth/admin';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Admin Gate
    const isAdmin = await checkAdminPrivilege(clerkUserId);
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
