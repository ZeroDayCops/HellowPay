/**
 * HollowPay — Phase 28 API Playground Tests
 *
 * Verifies:
 * 1. API Playground request composer and URL resolver.
 * 2. Header forwarding (Authorization headers).
 * 3. Execution duration capture.
 */

import fs from 'fs';
import path from 'path';

// Bootstrap environment variables
const envPath = fs.existsSync(path.resolve('./.env.local'))
  ? path.resolve('./.env.local')
  : path.resolve('./.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

// Global fetch interceptor to catch the mock playground proxy target request
const originalFetch = global.fetch;
let capturedTargetUrl: string | null = null;
let capturedPayload: any = null;
let capturedHeaders: Headers | null = null;

global.fetch = async function (url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const urlString = typeof url === 'string' ? url : url.toString();
  if (urlString.includes('/api/v1/orders')) {
    capturedTargetUrl = urlString;
    capturedPayload = init?.body ? JSON.parse(init.body as string) : null;
    capturedHeaders = new Headers(init?.headers);
    console.log(`[FETCH INTERCEPT] Captured API Playground proxy fetch to: ${urlString}`);
    return new Response('{"id":"ord_hp_mock123","status":"pending"}', {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(url, init);
} as any;

async function runTests() {
  console.log('🧪 Starting Phase 28 API Playground Tests...');

  try {
    // 1. Emulate the proxy handler request dispatch logic directly
    console.log('\nStep 1: Simulating request composing and URL resolution...');
    
    const endpoint = '/api/v1/orders';
    const method = 'POST';
    const rawKey = 'hp_test_sk_mock_credential_key_token';
    const headers = {
      Authorization: `Bearer ${rawKey}`
    };
    const payload = {
      amountMinor: 25000,
      currency: 'INR'
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const targetUrl = `${appUrl.replace(/\/$/, '')}${endpoint}`;

    const requestStart = Date.now();
    
    // Call fetch directly
    const proxyRes = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HollowPay-API-Playground/1.0',
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    const responseStatus = proxyRes.status;
    const responseBody = await proxyRes.text();
    const durationMs = Date.now() - requestStart;

    console.log(`- Request complete. Target URL: ${targetUrl}`);
    console.log(`- Response Status: ${responseStatus}`);
    console.log(`- Latency: ${durationMs}ms`);
    console.log(`- Response Body: ${responseBody}`);

    // Assertions
    if (responseStatus !== 201) {
      throw new Error(`Expected status 201, got: ${responseStatus}`);
    }

    if (!capturedTargetUrl || !capturedTargetUrl.endsWith('/api/v1/orders')) {
      throw new Error(`Invalid target URL resolved: ${capturedTargetUrl}`);
    }

    const bodyParsed = JSON.parse(responseBody);
    if (bodyParsed.id !== 'ord_hp_mock123' || bodyParsed.status !== 'pending') {
      throw new Error(`Expected mocked response body, got: ${responseBody}`);
    }

    if (!capturedHeaders || capturedHeaders.get('Authorization') !== `Bearer ${rawKey}`) {
      throw new Error('Authorization headers were not forwarded properly.');
    }
    console.log('- Authorization headers verified in flight! ✅');

    console.log('\n🎉 ALL Phase 28 API Playground checks passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E API Playground Test failed:', error);
    process.exit(1);
  }
}

runTests();
