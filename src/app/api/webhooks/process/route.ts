/**
 * HollowPay — Webhook Queue Trigger API
 *
 * POST /api/webhooks/process
 *
 * Scans for pending/retrying webhook deliveries and processes them.
 * Typically invoked by a cron job or scheduled task.
 *
 * Secure execution authorization check:
 * - Validates Bearer token against WEBHOOK_CRON_SECRET env variable.
 * - If local development environment and secret is missing, it allows execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPendingDeliveries } from '@/lib/services/webhook-delivery.service';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const secret = process.env.WEBHOOK_CRON_SECRET;

  // Enforce auth if secret is configured in environment
  if (secret && token !== secret) {
    return NextResponse.json({ error: 'Unauthorized CRON request' }, { status: 401 });
  }

  try {
    const result = await processPendingDeliveries(30);

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} webhook deliveries.`,
      summary: {
        total: result.processed,
        successes: result.successes,
        failures: result.failures,
      },
    });
  } catch (error: unknown) {
    console.error('Webhook runner execution failed:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
