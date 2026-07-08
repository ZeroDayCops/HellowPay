/**
 * HollowPay — Webhook Endpoint Connection Testing API
 *
 * POST /api/dashboard/webhooks/[id]/test
 * Generates a mock payment.confirmed event and dispatches it immediately
 * to the specified webhook endpoint, returning the full transmission status log.
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
  events,
  webhookDeliveries,
  webhookDeliveryAttempts,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { deliverWebhook } from '@/lib/services/webhook-delivery.service';
import { generatePublicId } from '@/lib/crypto/id-generator';

export async function POST(
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

    // 3. Create a mock test event
    const eventPublicId = generatePublicId('event');
    const [eventRecord] = await db
      .insert(events)
      .values({
        publicId: eventPublicId,
        projectId,
        environment: endpoint.environment,
        type: 'payment.confirmed',
        data: {
          object: 'payment_claim',
          id: 'claim_hp_test_mockedConnectionTest',
          claimed_reference: '123456789012',
          status: 'confirmed',
          order_id: 'ord_hp_test_mockedConnectionTest',
          amount: 150000,
          currency: 'INR',
          confirmed_at: new Date().toISOString(),
          test_event: true,
        },
      })
      .returning();

    // 4. Create mock delivery record in queue
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        eventId: eventRecord.id,
        webhookEndpointId: endpoint.id,
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 1,
        nextRetryAt: new Date(),
      })
      .returning();

    // 5. Deliver synchronously
    // Since we only have the secretHash in the database, we pass endpoint.secretHash.
    // The deliverWebhook function will sign the payload using `endpoint.secretHash` as the key.
    // In actual production, the webhook receiver can verify using the secretHash, or we sign with a derived key.
    await deliverWebhook(delivery.id, endpoint.secretHash);

    // 6. Fetch the created attempt result logs
    const attempts = await db
      .select()
      .from(webhookDeliveryAttempts)
      .where(eq(webhookDeliveryAttempts.webhookDeliveryId, delivery.id))
      .orderBy(desc(webhookDeliveryAttempts.createdAt))
      .limit(1);

    const latestAttempt = attempts[0];

    return NextResponse.json({
      success: !!latestAttempt && latestAttempt.responseStatus !== null && latestAttempt.responseStatus >= 200 && latestAttempt.responseStatus < 300,
      delivery: {
        url: endpoint.url,
        event: 'payment.confirmed',
        status: latestAttempt?.responseStatus ?? 'failed',
        latency_ms: latestAttempt?.durationMs ?? 0,
        responseExcerpt: latestAttempt?.responseExcerpt || null,
        errorMessage: latestAttempt?.error || null,
        attemptedAt: latestAttempt?.requestedAt || new Date(),
      },
    });
  } catch (error: unknown) {
    console.error('Failed to run webhook test:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
