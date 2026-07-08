/**
 * HollowPay — Webhook Delivery Manual Retry API
 *
 * POST /api/dashboard/webhooks/[id]/deliveries/[deliveryId]/retry
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
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { deliverWebhook } from '@/lib/services/webhook-delivery.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deliveryId: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const endpointPublicId = resolvedParams.id;
  const deliveryId = parseInt(resolvedParams.deliveryId, 10);

  if (isNaN(deliveryId)) {
    return NextResponse.json({ error: 'Invalid delivery ID.' }, { status: 400 });
  }

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

    // 2. Fetch target webhook endpoint
    const endpointResult = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.projectId, projectId),
          eq(webhookEndpoints.publicId, endpointPublicId)
        )
      )
      .limit(1);

    if (endpointResult.length === 0) {
      return NextResponse.json({ error: 'Webhook endpoint not found' }, { status: 404 });
    }

    const endpoint = endpointResult[0];

    // 3. Fetch delivery log
    const deliveryResult = await db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.webhookEndpointId, endpoint.id)
        )
      )
      .limit(1);

    if (deliveryResult.length === 0) {
      return NextResponse.json({ error: 'Webhook delivery log not found.' }, { status: 404 });
    }

    const delivery = deliveryResult[0];

    // 4. Reset delivery state to pending so deliverWebhook will accept and process it
    await db
      .update(webhookDeliveries)
      .set({
        status: 'pending',
        nextRetryAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    // 5. Trigger the webhook delivery synchronously
    const success = await deliverWebhook(delivery.id, endpoint.secretHash);

    // 6. Fetch updated delivery log to return latest state
    const [updatedDelivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, delivery.id))
      .limit(1);

    return NextResponse.json({
      success,
      status: updatedDelivery.status,
      attemptCount: updatedDelivery.attemptCount,
    });
  } catch (error: unknown) {
    console.error('Failed to manually retry webhook delivery:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
