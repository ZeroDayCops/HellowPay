/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — Local Mock Upload Receiver API Route
 *
 * Simulates receiving binary data uploads (PUT requests) for local development
 * when Cloudflare R2 credentials are not configured.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const key = searchParams.get('key') || 'unknown-asset';

  try {
    // Read the stream to verify payload arrives
    const buffer = await req.arrayBuffer();
    console.log(`[Mock R2 Storage] Received simulated PUT upload for key: "${key}" (${buffer.byteLength} bytes)`);

    return NextResponse.json({
      success: true,
      message: 'Simulated file upload completed successfully.',
      key,
      sizeBytes: buffer.byteLength,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Mock R2 Storage] Upload failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to parse upload request.',
    }, { status: 400 });
  }
}
