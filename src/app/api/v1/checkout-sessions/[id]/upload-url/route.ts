/**
 * HollowPay — Public Checkout Session Upload URL Route
 *
 * Implements:
 * - GET /api/v1/checkout-sessions/[id]/upload-url (Generate presigned upload URL for buyer claims)
 *
 * Scoped to the checkout session ID. Public endpoint (no API key auth required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { db } from '@/lib/db';
import { checkoutSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPresignedUploadUrl } from '@/lib/storage/r2';
import { BadRequestError, NotFoundError } from '@/lib/api/errors';
import { generatePublicId } from '@/lib/crypto/id-generator';

const handleGetUploadUrl = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  // Await params for Next.js 15+ async route param compliance
  const resolvedParams = await params;
  const publicId = resolvedParams.id;

  if (!publicId) {
    throw new BadRequestError('Checkout Session ID parameter is missing.');
  }

  // Fetch checkout session (public access - verify existence)
  const sessionResult = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.publicId, publicId))
    .limit(1);

  const session = sessionResult[0];
  if (!session) {
    throw new NotFoundError(`Checkout session with ID "${publicId}" not found.`);
  }

  const { searchParams } = req.nextUrl;
  const contentType = searchParams.get('content_type') || 'image/jpeg';
  
  // Validate allowed mime types
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedMimeTypes.includes(contentType)) {
    throw new BadRequestError(`Invalid content_type. Supported formats: ${allowedMimeTypes.join(', ')}`);
  }

  // Determine file extension
  let extension = 'jpg';
  if (contentType.includes('png')) extension = 'png';
  if (contentType.includes('webp')) extension = 'webp';

  // Generate unique screenshot object key in the format: claims/cs_hp_.../audit_id.ext
  const randomId = generatePublicId('audit').replace('aud_hp_', '');
  const objectKey = `claims/${session.publicId}/${randomId}.${extension}`;

  const uploadConfig = await getPresignedUploadUrl(objectKey, contentType);

  return NextResponse.json({
    upload_url: uploadConfig.uploadUrl,
    public_url: uploadConfig.publicUrl,
    screenshot_key: objectKey, // To be submitted during claim
    is_mock: uploadConfig.isMock,
  }, { status: 200 });
};

// Public endpoint
export const GET = wrapRouteHandler(handleGetUploadUrl, { authRequired: false });
