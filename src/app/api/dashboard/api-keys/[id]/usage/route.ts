/**
 * HollowPay — API Key Usage Telemetry API
 *
 * GET /api/dashboard/api-keys/[id]/usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, apiKeys, apiKeyUsage } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: publicId } = await params;

  try {
    // 1. Resolve project context
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const membership = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, profile[0].id))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const biz = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, membership[0].workspaceId))
      .limit(1);

    if (biz.length === 0) {
      return NextResponse.json({ error: 'Business settings not found' }, { status: 404 });
    }

    const proj = await db
      .select()
      .from(projects)
      .where(eq(projects.businessId, biz[0].id))
      .limit(1);

    if (proj.length === 0) {
      return NextResponse.json({ error: 'Project not configured' }, { status: 404 });
    }

    const projectId = proj[0].id;

    // 2. Fetch the target API key
    const keyList = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.prefix, publicId),
          eq(apiKeys.projectId, projectId)
        )
      )
      .limit(1);

    if (keyList.length === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }
    const apiKey = keyList[0];

    // 3. Generate last 7 days dates YYYY-MM-DD
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().substring(0, 10));
    }

    // 4. Query usage logs for those dates
    const dbUsage = await db
      .select()
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.apiKeyId, apiKey.id),
          inArray(apiKeyUsage.date, dates)
        )
      );

    // Map DB results to dates array
    const usageMap = new Map(dbUsage.map((u) => [u.date, u.requestCount]));
    const chartData = dates.map((date) => {
      // Get readable label: e.g. "Jul 09" or "Jul 8"
      const d = new Date(date);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      return {
        date,
        label,
        count: usageMap.get(date) || 0,
      };
    });

    return NextResponse.json({
      apiKeyId: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      lastUsedAt: apiKey.lastUsedAt,
      usage: chartData,
    });
  } catch (error: unknown) {
    console.error('Failed to query API key usage metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
