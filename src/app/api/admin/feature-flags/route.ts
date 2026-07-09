/**
 * HollowPay — Administrative Feature Flags API
 *
 * GET  /api/admin/feature-flags — Lists all flags (Admin-only)
 * POST /api/admin/feature-flags — Upserts a feature flag configuration (Admin-only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkAdminPrivilege } from '@/lib/auth/admin';
import { listFeatureFlags, setFeatureFlag } from '@/lib/services/feature-flag.service';



export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = await checkAdminPrivilege(clerkUserId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Permission denied. Founder account required.' }, { status: 403 });
  }

  try {
    const flags = await listFeatureFlags();
    return NextResponse.json({ success: true, flags });
  } catch (error: unknown) {
    console.error('Failed to retrieve feature flags:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = await checkAdminPrivilege(clerkUserId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Permission denied. Founder account required.' }, { status: 403 });
  }

  let body: {
    key: string;
    enabled: boolean;
    scope?: 'global' | 'workspace' | 'project';
    scopeId?: string;
    description?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { key, enabled, scope, scopeId, description } = body;

  if (!key || !key.trim()) {
    return NextResponse.json({ error: 'Feature flag key is required.' }, { status: 400 });
  }

  try {
    const flag = await setFeatureFlag({
      key: key.trim(),
      enabled,
      scope: scope || 'global',
      scopeId: scopeId || null,
      description: description || null,
    });

    return NextResponse.json({ success: true, flag });
  } catch (error: unknown) {
    console.error('Failed to upsert feature flag:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
