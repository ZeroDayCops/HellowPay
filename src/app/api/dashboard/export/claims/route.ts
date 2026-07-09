/**
 * HollowPay — Claims CSV Export API
 *
 * GET /api/dashboard/export/claims — Downloads payment claims CSV report
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { exportClaimsCsv } from '@/lib/services/export.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';

  try {
    // Resolve project context
    const profile = await db.select().from(userProfiles).where(eq(userProfiles.clerkUserId, clerkUserId)).limit(1);
    if (profile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const membership = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, profile[0].id)).limit(1);
    if (membership.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const biz = await db.select().from(businesses).where(eq(businesses.workspaceId, membership[0].workspaceId)).limit(1);
    if (biz.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const proj = await db.select().from(projects).where(eq(projects.businessId, biz[0].id)).limit(1);
    if (proj.length === 0) {
      return NextResponse.json({ error: 'Project not configured' }, { status: 404 });
    }

    const csv = await exportClaimsCsv(proj[0].id, environment);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hollowpay_claims_${environment}_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to export claims CSV:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
