/**
 * HollowPay — Webhook Endpoint Deliveries History API
 *
 * GET /api/dashboard/webhooks/[id]/deliveries
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  userProfiles,
  workspaceMembers,
  businesses,
  projects,
  webhookEndpoints,
  webhookDeliveries,
  webhookDeliveryAttempts,
  events,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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

    // 2. Fetch endpoint
    const endpointResult = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.projectId, projectId),
          eq(webhookEndpoints.publicId, publicId)
        )
      )
      .limit(1);

    if (endpointResult.length === 0) {
      return NextResponse.json({ error: 'Webhook endpoint not found' }, { status: 404 });
    }

    const endpoint = endpointResult[0];

    // 3. Fetch webhook deliveries with event details
    const deliveriesResult = await db
      .select({
        deliveryId: webhookDeliveries.id,
        deliveryStatus: webhookDeliveries.status,
        attemptCount: webhookDeliveries.attemptCount,
        maxAttempts: webhookDeliveries.maxAttempts,
        nextRetryAt: webhookDeliveries.nextRetryAt,
        createdAt: webhookDeliveries.createdAt,
        updatedAt: webhookDeliveries.updatedAt,
        eventPublicId: events.publicId,
        eventType: events.type,
        eventCreatedAt: events.createdAt,
      })
      .from(webhookDeliveries)
      .innerJoin(events, eq(webhookDeliveries.eventId, events.id))
      .where(eq(webhookDeliveries.webhookEndpointId, endpoint.id))
      .orderBy(desc(webhookDeliveries.id))
      .limit(50);

    // 4. For each delivery, fetch its attempts
    const result = [];
    for (const d of deliveriesResult) {
      const attempts = await db
        .select()
        .from(webhookDeliveryAttempts)
        .where(eq(webhookDeliveryAttempts.webhookDeliveryId, d.deliveryId))
        .orderBy(desc(webhookDeliveryAttempts.createdAt));

      result.push({
        ...d,
        attempts,
      });
    }

    return NextResponse.json({ deliveries: result });
  } catch (error: unknown) {
    console.error('Failed to list webhook delivery logs:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
