/**
 * HollowPay — Orders List API
 *
 * GET /api/dashboard/orders — Lists all customer orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, orders, customers } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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

    // 2. Fetch orders with customer details
    const list = await db
      .select({
        order: orders,
        customer: customers,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(
        and(
          eq(orders.projectId, projectId),
          eq(orders.environment, environment)
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(100);

    return NextResponse.json({ orders: list });
  } catch (error: unknown) {
    console.error('Failed to list orders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
