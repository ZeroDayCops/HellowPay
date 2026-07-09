/**
 * HollowPay — Admin Data API
 *
 * GET /api/admin/data — Returns comprehensive platform data for the admin dashboard.
 *   ?tab=users|orders|payments|workspaces|overview
 *
 * Access restricted to superadmin accounts only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  userProfiles,
  workspaces,
  workspaceMembers,
  orders,
  paymentAttempts,
  paymentClaims,
  transactions,
  checkoutSessions,
  projects,
  businesses,
  customers,
  apiKeys,
  webhookEndpoints,
  auditLogs,
} from '@/lib/db/schema';
import { desc, count, sql, eq, sum } from 'drizzle-orm';
import { checkAdminPrivilege } from '@/lib/auth/admin';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = await checkAdminPrivilege(clerkUserId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const tab = req.nextUrl.searchParams.get('tab') || 'overview';

  try {
    if (tab === 'overview') {
      // Aggregate counts and volume stats
      const [
        [userCount],
        [workspaceCount],
        [orderCount],
        [projectCount],
        [customerCount],
        totalVolume,
        recentOrders,
        recentUsers,
      ] = await Promise.all([
        db.select({ value: count() }).from(userProfiles),
        db.select({ value: count() }).from(workspaces),
        db.select({ value: count() }).from(orders),
        db.select({ value: count() }).from(projects),
        db.select({ value: count() }).from(customers),
        db
          .select({
            totalMinor: sum(orders.amountMinor),
            paidCount: count(sql`CASE WHEN ${orders.status} = 'paid' THEN 1 END`),
            activeCount: count(sql`CASE WHEN ${orders.status} = 'active' THEN 1 END`),
            expiredCount: count(sql`CASE WHEN ${orders.status} = 'expired' THEN 1 END`),
          })
          .from(orders),
        db
          .select({
            publicId: orders.publicId,
            amountMinor: orders.amountMinor,
            currency: orders.currency,
            status: orders.status,
            environment: orders.environment,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .orderBy(desc(orders.createdAt))
          .limit(10),
        db
          .select({
            publicId: userProfiles.publicId,
            email: userProfiles.email,
            name: userProfiles.name,
            isAdmin: userProfiles.isAdmin,
            createdAt: userProfiles.createdAt,
          })
          .from(userProfiles)
          .orderBy(desc(userProfiles.createdAt))
          .limit(10),
      ]);

      return NextResponse.json({
        overview: {
          totalUsers: userCount.value,
          totalWorkspaces: workspaceCount.value,
          totalOrders: orderCount.value,
          totalProjects: projectCount.value,
          totalCustomers: customerCount.value,
          volume: totalVolume[0] || { totalMinor: 0, paidCount: 0, activeCount: 0, expiredCount: 0 },
          recentOrders,
          recentUsers,
        },
      });
    }

    if (tab === 'users') {
      const users = await db
        .select({
          id: userProfiles.id,
          publicId: userProfiles.publicId,
          clerkUserId: userProfiles.clerkUserId,
          email: userProfiles.email,
          name: userProfiles.name,
          isAdmin: userProfiles.isAdmin,
          createdAt: userProfiles.createdAt,
          updatedAt: userProfiles.updatedAt,
        })
        .from(userProfiles)
        .orderBy(desc(userProfiles.createdAt))
        .limit(200);

      return NextResponse.json({ users });
    }

    if (tab === 'orders') {
      const allOrders = await db
        .select({
          id: orders.id,
          publicId: orders.publicId,
          amountMinor: orders.amountMinor,
          currency: orders.currency,
          status: orders.status,
          environment: orders.environment,
          merchantOrderId: orders.merchantOrderId,
          description: orders.description,
          createdAt: orders.createdAt,
          expiresAt: orders.expiresAt,
          projectName: projects.name,
        })
        .from(orders)
        .leftJoin(projects, eq(orders.projectId, projects.id))
        .orderBy(desc(orders.createdAt))
        .limit(200);

      return NextResponse.json({ orders: allOrders });
    }

    if (tab === 'payments') {
      const claims = await db
        .select({
          id: paymentClaims.id,
          publicId: paymentClaims.publicId,
          status: paymentClaims.status,
          utrNumber: paymentClaims.claimedReference,
          createdAt: paymentClaims.createdAt,
          orderPublicId: orders.publicId,
          orderAmount: orders.amountMinor,
          orderCurrency: orders.currency,
        })
        .from(paymentClaims)
        .leftJoin(paymentAttempts, eq(paymentClaims.paymentAttemptId, paymentAttempts.id))
        .leftJoin(orders, eq(paymentAttempts.orderId, orders.id))
        .orderBy(desc(paymentClaims.createdAt))
        .limit(200);

      const txns = await db
        .select({
          id: transactions.id,
          publicId: transactions.publicId,
          status: sql<string>`'settled'`,
          amountMinor: transactions.amountMinor,
          currency: transactions.currency,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .orderBy(desc(transactions.createdAt))
        .limit(100);

      return NextResponse.json({ claims, transactions: txns });
    }

    if (tab === 'workspaces') {
      const allWorkspaces = await db
        .select({
          id: workspaces.id,
          publicId: workspaces.publicId,
          name: workspaces.name,
          slug: workspaces.slug,
          createdAt: workspaces.createdAt,
        })
        .from(workspaces)
        .orderBy(desc(workspaces.createdAt))
        .limit(100);

      return NextResponse.json({ workspaces: allWorkspaces });
    }

    return NextResponse.json({ error: 'Invalid tab parameter' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Admin data API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
