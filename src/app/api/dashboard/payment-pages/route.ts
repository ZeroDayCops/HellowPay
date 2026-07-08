/**
 * HollowPay — Payment Pages Dashboard API
 *
 * GET  /api/dashboard/payment-pages — Lists payment pages
 * POST /api/dashboard/payment-pages — Creates a new payment page
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createPaymentPage, listPaymentPages } from '@/lib/services/payment-page.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // 2. Fetch pages list
    const pages = await listPaymentPages(projectId);

    return NextResponse.json({ pages });
  } catch (error: unknown) {
    console.error('Failed to list payment pages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    slug: string;
    type: 'product' | 'service' | 'quick_payment';
    title: string;
    description?: string;
    amount_minor: number;
    currency?: string;
    collect_name?: boolean;
    collect_email?: boolean;
    collect_phone?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { slug, type, title, description, amount_minor, currency, collect_name, collect_email, collect_phone } = body;

  if (!slug || !title || !amount_minor) {
    return NextResponse.json({ error: 'Slug, title, and amount are required.' }, { status: 400 });
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

    // 2. Create the payment page
    // Hardcode environment to live/test depending on dashboard settings or create page under workspace
    // Let's create page. It will automatically resolve in checkout under either mode.
    const page = await createPaymentPage({
      projectId,
      environment: 'test', // General test mode placeholder
      slug,
      type,
      title,
      description,
      amountMinor: amount_minor,
      currency,
      collectName: collect_name,
      collectEmail: collect_email,
      collectPhone: collect_phone,
    });

    return NextResponse.json({ success: true, page }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create payment page:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
