/**
 * HollowPay — API Keys Dashboard API
 *
 * GET  /api/dashboard/api-keys — Lists keys
 * POST /api/dashboard/api-keys — Generates a new API key pair
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, projects, apiKeys } from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { generateApiKey } from '@/lib/crypto/api-key-generator';

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

    // 2. Query active API keys
    const keysList = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.projectId, projectId),
          eq(apiKeys.environment, environment),
          isNull(apiKeys.revokedAt)
        )
      )
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ keys: keysList });
  } catch (error: unknown) {
    console.error('Failed to list API keys:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    name: string;
    key_type: 'publishable' | 'secret';
    environment: 'test' | 'live';
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { name, key_type, environment } = body;

  if (!name || !key_type || !environment) {
    return NextResponse.json({ error: 'Name, key_type, and environment are required.' }, { status: 400 });
  }

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

    // 2. Generate key
    const generated = generateApiKey(environment, key_type);

    // 3. Save key parameters to DB
    const [insertedKey] = await db
      .insert(apiKeys)
      .values({
        projectId,
        environment,
        keyType: key_type,
        prefix: generated.prefix,
        lastFour: generated.lastFour,
        keyHash: generated.keyHash,
        scopes: JSON.stringify(['*']), // default wildcard scopes
        name: name.trim(),
        createdBy: profile[0].id,
      })
      .returning();

    return NextResponse.json({
      success: true,
      key: insertedKey,
      raw_key: generated.key, // Send once for merchant copy paste
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
