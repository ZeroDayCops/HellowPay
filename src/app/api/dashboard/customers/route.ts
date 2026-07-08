/**
 * HollowPay — Customer Profiles Dashboard API
 *
 * GET /api/dashboard/customers — Lists customers with aggregated spent metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, customers, orders } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

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

    // 2. Fetch customer list with aggregated spent volume and order counts
    const list = await db
      .select({
        id: customers.id,
        publicId: customers.publicId,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        createdAt: customers.createdAt,
        orderCount: sql<number>`count(${orders.id})`.mapWith(Number),
        totalSpent: sql<number>`coalesce(sum(case when ${orders.status} = 'confirmed' or ${orders.status} = 'paid' then ${orders.amountMinor} else 0 end), 0)`.mapWith(Number),
      })
      .from(customers)
      .leftJoin(
        orders,
        and(
          eq(orders.customerId, customers.id),
          eq(orders.environment, environment)
        )
      )
      .where(eq(customers.projectId, projectId))
      .groupBy(customers.id)
      .orderBy(desc(customers.createdAt))
      .limit(100);

    return NextResponse.json({ customers: list });
  } catch (error: unknown) {
    console.error('Failed to list customers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
