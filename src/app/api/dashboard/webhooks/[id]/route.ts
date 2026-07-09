/**
 * HollowPay — Webhook Endpoint Revocation API
 *
 * DELETE /api/dashboard/webhooks/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, webhookEndpoints, webhookEndpointSubscriptions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revokeWebhookEndpoint } from '@/lib/services/webhook-delivery.service';
import { createAuditLog } from '@/lib/services/audit.service';

export async function DELETE(
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

    // 2. Execute soft delete revocation
    await revokeWebhookEndpoint(projectId, publicId);

    await createAuditLog({
      action: 'webhook_endpoint_deleted',
      targetType: 'webhook_endpoint',
      targetId: publicId,
      workspaceId: membership[0].workspaceId,
      userId: profile[0].id,
      metadata: {
        publicId,
      },
    });

    return NextResponse.json({ success: true, message: 'Webhook endpoint deleted.' });
  } catch (error: unknown) {
    console.error('Failed to delete webhook endpoint:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: publicId } = await params;

  let body: { url: string; description?: string; event_types: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const { url, description, event_types } = body;
  if (!url) {
    return NextResponse.json({ error: 'URL destination is required' }, { status: 400 });
  }

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

    // 2. Fetch the target webhook endpoint
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

    // 3. Update fields and subscriptions inside transaction
    await db.transaction(async (tx) => {
      await tx
        .update(webhookEndpoints)
        .set({
          url: url.trim(),
          description: description?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, endpoint.id));

      await tx
        .delete(webhookEndpointSubscriptions)
        .where(eq(webhookEndpointSubscriptions.webhookEndpointId, endpoint.id));

      if (event_types && event_types.length > 0) {
        await tx.insert(webhookEndpointSubscriptions).values(
          event_types.map((type) => ({
            webhookEndpointId: endpoint.id,
            eventType: type,
          }))
        );
      }
    });

    await createAuditLog({
      action: 'webhook_endpoint_updated',
      targetType: 'webhook_endpoint',
      targetId: publicId,
      workspaceId: membership[0].workspaceId,
      userId: profile[0].id,
      metadata: {
        publicId,
        url,
        event_types,
      },
    });

    return NextResponse.json({ success: true, message: 'Webhook endpoint updated successfully.' });
  } catch (error: unknown) {
    console.error('Failed to update webhook endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
