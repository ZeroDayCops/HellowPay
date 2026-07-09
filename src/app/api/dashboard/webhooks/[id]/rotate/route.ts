/**
 * HollowPay — Webhook Endpoint Secret Rotation API
 *
 * POST /api/dashboard/webhooks/[id]/rotate
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, webhookEndpoints } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateToken, sha256 } from '@/lib/crypto/hash';
import { createAuditLog } from '@/lib/services/audit.service';

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

    // 3. Generate new raw secret & update database fields
    const rawSecret = `whsec_${generateToken(16)}`;
    const secretHash = sha256(rawSecret);
    const secretLastFour = rawSecret.slice(-4);

    await db
      .update(webhookEndpoints)
      .set({
        secretHash,
        secretLastFour,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, endpoint.id));

    // 4. Log audit event
    await createAuditLog({
      action: 'webhook_endpoint_secret_rotated',
      targetType: 'webhook_endpoint',
      targetId: publicId,
      workspaceId: membership[0].workspaceId,
      userId: profile[0].id,
      metadata: {
        publicId,
        secretLastFour,
      },
    });

    return NextResponse.json({
      success: true,
      rawSecret,
      secretLastFour,
    });
  } catch (error: unknown) {
    console.error('Failed to rotate webhook secret:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
