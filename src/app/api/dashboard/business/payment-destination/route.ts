/**
 * HollowPay — Business Payment Destination API
 *
 * GET  /api/dashboard/business/payment-destination — Retrieves active UPI credentials
 * POST /api/dashboard/business/payment-destination — Modifies UPI ID destination settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, paymentDestinations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createAuditLog } from '@/lib/services/audit.service';

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';

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

    // 2. Fetch destination config
    const dests = await db
      .select()
      .from(paymentDestinations)
      .where(
        and(
          eq(paymentDestinations.projectId, projectId),
          eq(paymentDestinations.environment, environment)
        )
      )
      .limit(1);

    if (dests.length === 0) {
      return NextResponse.json({
        destination: {
          status: 'not_configured',
          upiId: '',
          payeeName: '',
        }
      });
    }

    return NextResponse.json({ destination: dests[0] });
  } catch (error: unknown) {
    console.error('Failed to retrieve payment destination:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';

  let body: {
    upi_id: string;
    payee_name: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { upi_id, payee_name } = body;

  if (!upi_id || !payee_name) {
    return NextResponse.json({ error: 'UPI VPA ID and Payee Name are required.' }, { status: 400 });
  }

  // Validate format of UPI VPA
  if (!UPI_REGEX.test(upi_id.trim())) {
    return NextResponse.json({ error: 'Invalid UPI VPA address format (e.g. name@bank).' }, { status: 400 });
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

    // 2. Check if destination already configured in this environment
    const existing = await db
      .select()
      .from(paymentDestinations)
      .where(
        and(
          eq(paymentDestinations.projectId, projectId),
          eq(paymentDestinations.environment, environment)
        )
      )
      .limit(1);

    let destination;

    if (existing.length > 0) {
      // Update
      const [updated] = await db
        .update(paymentDestinations)
        .set({
          upiId: upi_id.trim(),
          payeeName: payee_name.trim(),
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(paymentDestinations.id, existing[0].id))
        .returning();
      destination = updated;
    } else {
      // Insert
      const [inserted] = await db
        .insert(paymentDestinations)
        .values({
          projectId,
          environment,
          type: 'upi',
          upiId: upi_id.trim(),
          payeeName: payee_name.trim(),
          status: 'active',
        })
        .returning();
      destination = inserted;
    }

    await createAuditLog({
      action: 'payment_destination_changed',
      targetType: 'payment_destination',
      targetId: String(destination.id),
      workspaceId: membership[0].workspaceId,
      userId: profile[0].id,
      metadata: {
        environment,
        upiId: destination.upiId,
      },
    });

    return NextResponse.json({ success: true, destination });
  } catch (error: unknown) {
    console.error('Failed to configure payment destination:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
