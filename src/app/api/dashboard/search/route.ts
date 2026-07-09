/**
 * HollowPay — Unified Search API
 *
 * GET /api/dashboard/search?q=<query>&env=<test|live>
 * Returns navigation matches and entity search results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { unifiedSearch } from '@/lib/services/search.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
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

    const results = await unifiedSearch(proj[0].id, environment, query);

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error('Search failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
