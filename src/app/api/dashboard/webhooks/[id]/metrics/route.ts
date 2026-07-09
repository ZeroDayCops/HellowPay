/**
 * HollowPay — Webhook Endpoint Metrics API
 *
 * GET /api/dashboard/webhooks/[id]/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, webhookEndpoints, webhookDeliveries, webhookDeliveryAttempts } from '@/lib/db/schema';
import { eq, and, avg, count } from 'drizzle-orm';

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
    // 1. Resolve project contexts
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

    // 2. Fetch target webhook endpoint
    const endpointList = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.publicId, publicId),
          eq(webhookEndpoints.projectId, projectId)
        )
      )
      .limit(1);

    if (endpointList.length === 0) {
      return NextResponse.json({ error: 'Webhook endpoint not found' }, { status: 404 });
    }
    const endpoint = endpointList[0];

    // 3. Fetch delivery logs and compute aggregates
    const attempts = await db
      .select({
        attemptId: webhookDeliveryAttempts.id,
        status: webhookDeliveryAttempts.responseStatus,
        duration: webhookDeliveryAttempts.durationMs,
      })
      .from(webhookDeliveryAttempts)
      .innerJoin(webhookDeliveries, eq(webhookDeliveryAttempts.webhookDeliveryId, webhookDeliveries.id))
      .where(eq(webhookDeliveries.webhookEndpointId, endpoint.id));

    const totalAttempts = attempts.length;
    let successfulAttempts = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    attempts.forEach((att) => {
      if (att.status !== null && att.status >= 200 && att.status < 300) {
        successfulAttempts++;
      }
      if (att.duration !== null) {
        totalLatency += att.duration;
        latencyCount++;
      }
    });

    const successRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 100;
    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;
    const failuresCount = totalAttempts - successfulAttempts;

    return NextResponse.json({
      metrics: {
        totalAttempts,
        successRate,
        avgLatency,
        failuresCount,
      }
    });
  } catch (error: unknown) {
    console.error('Failed to query webhook metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
