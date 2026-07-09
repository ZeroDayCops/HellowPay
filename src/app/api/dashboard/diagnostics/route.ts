/**
 * HollowPay — Diagnostics Telemetry API
 *
 * GET /api/dashboard/diagnostics
 * Returns system health metrics, database latency, webhook queues, and env configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, webhookDeliveries } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Resolve actor to verify session
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 2. Measure Database connection latency
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    const dbLatencyMs = Date.now() - dbStart;

    // 3. Count Webhook queue status
    const pendingWebhooks = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.status, 'pending'));

    const failedWebhooks = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.status, 'failed'));

    // 4. Gather system environments status
    const memory = process.memoryUsage();
    const systemMetrics = {
      database: {
        status: 'healthy',
        latencyMs: dbLatencyMs,
        driver: process.env.DATABASE_URL?.includes('neon.tech') ? 'neon-http' : 'node-postgres',
      },
      webhooks: {
        pendingQueueSize: Number(pendingWebhooks[0]?.count || 0),
        failedQueueSize: Number(failedWebhooks[0]?.count || 0),
      },
      system: {
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryHeapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        memoryHeapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
        envFlags: {
          clerkConfigured: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
          r2Configured: !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
          isMockUploadEnabled: !process.env.R2_BUCKET_NAME,
        },
      },
    };

    return NextResponse.json(systemMetrics);
  } catch (error: unknown) {
    console.error('Diagnostics check failed:', error);
    return NextResponse.json(
      {
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Unknown diagnostics error',
      },
      { status: 500 }
    );
  }
}
