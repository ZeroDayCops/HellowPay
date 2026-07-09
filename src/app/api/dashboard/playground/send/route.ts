/**
 * HollowPay — API Playground Proxy Handler
 *
 * POST /api/dashboard/playground/send
 * Proxies request execution to internal v1 API endpoints using the client's raw API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    endpoint: string;
    method: string;
    headers: Record<string, string>;
    payload?: any;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { endpoint, method, headers, payload } = body;
  if (!endpoint || !method || !headers) {
    return NextResponse.json({ error: 'Endpoint, method, and headers are required.' }, { status: 400 });
  }

  try {
    // Construct local base URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const targetUrl = `${appUrl.replace(/\/$/, '')}${endpoint}`;

    const requestStart = Date.now();
    let responseStatus = 0;
    let responseBody = '';
    const responseHeaders: Record<string, string> = {};

    try {
      const proxyRes = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HollowPay-API-Playground/1.0',
          ...headers,
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      responseStatus = proxyRes.status;
      responseBody = await proxyRes.text();
      proxyRes.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });
    } catch (fetchError) {
      responseStatus = 500;
      responseBody = fetchError instanceof Error ? fetchError.message : 'Local connection failed';
    }

    const durationMs = Date.now() - requestStart;

    return NextResponse.json({
      status: responseStatus,
      durationMs,
      headers: responseHeaders,
      body: responseBody,
    });
  } catch (error: unknown) {
    console.error('Playground proxy failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
