/**
 * HollowPay — Local Webhook Receiver Mock Endpoint (For test isolation)
 *
 * POST /api/mock-webhook-receiver
 * Returns 200 OK immediately with the received payload headers and body.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('HollowPay-Signature') || '';
    const body = await req.json();

    console.log('📬 [MOCK RECEIVER] Received Webhook Payload:');
    console.log(`- Signature: ${signature}`);
    console.log(`- Body:`, JSON.stringify(body));

    return NextResponse.json({
      received: true,
      signature,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad Request' }, { status: 400 });
  }
}
