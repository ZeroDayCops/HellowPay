/**
 * HollowPay — Webhooks Events Simulator API
 *
 * POST /api/dashboard/webhooks/[id]/simulate
 * Simulates a webhook event dispatch and reports the receiver HTTP response metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, webhookEndpoints } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { signWebhookPayload } from '@/lib/crypto/webhook-signer';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: webhookEndpointIdStr } = await params;
  const webhookEndpointId = parseInt(webhookEndpointIdStr, 10);
  if (isNaN(webhookEndpointId)) {
    return NextResponse.json({ error: 'Invalid webhook endpoint ID' }, { status: 400 });
  }

  const { type } = await req.json();
  if (!type) {
    return NextResponse.json({ error: 'Event type is required' }, { status: 400 });
  }

  try {
    // 1. Resolve user profile
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

    const activeProjectId = proj[0].id;

    // 2. Resolve webhook endpoint and verify it belongs to this project
    const endpointList = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, webhookEndpointId),
          eq(webhookEndpoints.projectId, activeProjectId)
        )
      )
      .limit(1);

    if (endpointList.length === 0) {
      return NextResponse.json({ error: 'Webhook endpoint not found' }, { status: 404 });
    }
    const endpoint = endpointList[0];

    // 3. Generate mock payload data matching the event type
    const timestamp = Date.now();
    const eventId = `evt_hp_sim_${Math.random().toString(36).substring(2, 15)}`;
    
    let mockData = {};
    if (type === 'claim.created') {
      mockData = {
        claimId: 'clm_hp_sim_9k8L7mP2',
        orderId: 'ord_hp_sim_12345',
        claimedReference: 'UTR123456789012',
        status: 'pending',
        amountMinor: 25000,
        currency: 'INR',
        claimedAt: new Date().toISOString(),
      };
    } else if (type === 'claim.confirmed') {
      mockData = {
        claimId: 'clm_hp_sim_9k8L7mP2',
        orderId: 'ord_hp_sim_12345',
        claimedReference: 'UTR123456789012',
        status: 'confirmed',
        amountMinor: 25000,
        currency: 'INR',
        confirmedAt: new Date().toISOString(),
      };
    } else if (type === 'claim.rejected') {
      mockData = {
        claimId: 'clm_hp_sim_9k8L7mP2',
        orderId: 'ord_hp_sim_12345',
        status: 'rejected',
        rejectReason: 'Mismatched payment screenshot verification.',
        amountMinor: 25000,
        currency: 'INR',
        rejectedAt: new Date().toISOString(),
      };
    } else {
      // Default / general fallback mock data
      mockData = {
        simulation: true,
        triggeredBy: profile[0].email,
        timestamp: new Date().toISOString(),
      };
    }

    const payloadObj = {
      id: eventId,
      type,
      createdAt: new Date().toISOString(),
      data: mockData,
    };

    const payloadString = JSON.stringify(payloadObj, null, 2);

    // 4. Generate Webhook signature using endpoint secretHash
    const signature = signWebhookPayload(payloadString, endpoint.secretHash, timestamp);

    // 5. Fire direct request to target endpoint
    const requestStart = Date.now();
    let responseStatus = 0;
    let responseBody = '';
    const responseHeaders: Record<string, string> = {};

    try {
      const dispatchRes = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'HollowPay-Signature': signature,
          'User-Agent': 'HollowPay-Webhook-Simulator/1.0',
        },
        body: payloadString,
      });

      responseStatus = dispatchRes.status;
      responseBody = await dispatchRes.text();
      dispatchRes.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });
    } catch (dispatchError) {
      responseStatus = 0;
      responseBody = dispatchError instanceof Error ? dispatchError.message : 'Connection failed';
    }

    const durationMs = Date.now() - requestStart;

    return NextResponse.json({
      url: endpoint.url,
      eventType: type,
      payload: payloadObj,
      response: {
        status: responseStatus,
        durationMs,
        body: responseBody.slice(0, 2000), // cap preview size
        headers: responseHeaders,
      },
    });
  } catch (error: unknown) {
    console.error('Webhook simulation dispatch failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
