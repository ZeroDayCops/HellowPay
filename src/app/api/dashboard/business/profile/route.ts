/**
 * HollowPay — Business Settings Profile API
 *
 * GET  /api/dashboard/business/profile — Retrieves company profile and theme branding info
 * POST /api/dashboard/business/profile — Updates company metadata contacts and custom colors
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles, workspaceMembers, businesses, businessBranding } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Resolve workspace context
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

    const bizList = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, membership[0].workspaceId))
      .limit(1);

    if (bizList.length === 0) {
      return NextResponse.json({ error: 'Business details not found' }, { status: 404 });
    }

    const business = bizList[0];

    // 2. Fetch branding
    const brandingList = await db
      .select()
      .from(businessBranding)
      .where(eq(businessBranding.businessId, business.id))
      .limit(1);

    const branding = brandingList[0] || {
      logoObjectKey: null,
      primaryColor: '#4A154B', // default aubergine accent color
    };

    return NextResponse.json({ business, branding });
  } catch (error: unknown) {
    console.error('Failed to retrieve business profile:', error);
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
    website?: string;
    support_email?: string;
    support_phone?: string;
    primary_color?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { name, website, support_email, support_phone, primary_color } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Business display name is required.' }, { status: 400 });
  }

  // Validate hex color if provided
  if (primary_color && !HEX_COLOR_REGEX.test(primary_color.trim())) {
    return NextResponse.json({ error: 'Invalid hex color value (e.g. #4A154B).' }, { status: 400 });
  }

  try {
    // 1. Resolve workspace context
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

    const bizList = await db
      .select()
      .from(businesses)
      .where(eq(businesses.workspaceId, membership[0].workspaceId))
      .limit(1);

    if (bizList.length === 0) {
      return NextResponse.json({ error: 'Business details not found' }, { status: 404 });
    }

    const business = bizList[0];

    // 2. Perform updates atomically
    const result = await db.transaction(async (tx) => {
      // Update business contacts
      const [updatedBiz] = await tx
        .update(businesses)
        .set({
          name: name.trim(),
          website: website?.trim() || null,
          supportEmail: support_email?.trim() || null,
          supportPhone: support_phone?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, business.id))
        .returning();

      // Update or insert business branding hex color
      const existingBranding = await tx
        .select()
        .from(businessBranding)
        .where(eq(businessBranding.businessId, business.id))
        .limit(1);

      let branding;
      const colorVal = primary_color?.trim() || '#4A154B';

      if (existingBranding.length > 0) {
        const [updatedBrand] = await tx
          .update(businessBranding)
          .set({
            primaryColor: colorVal,
            updatedAt: new Date(),
          })
          .where(eq(businessBranding.id, existingBranding[0].id))
          .returning();
        branding = updatedBrand;
      } else {
        const [insertedBrand] = await tx
          .insert(businessBranding)
          .values({
            businessId: business.id,
            primaryColor: colorVal,
          })
          .returning();
        branding = insertedBrand;
      }

      return { business: updatedBiz, branding };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Failed to update business profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
