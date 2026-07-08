/**
 * HollowPay — Cloudflare R2 Storage Provider
 *
 * Configures the AWS S3 client targeting Cloudflare R2.
 * Includes graceful mock fallbacks for local/offline environments lacking R2 credentials.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'hollowpay-uploads';
const publicUrl = process.env.R2_PUBLIC_URL;

// Resolve if R2 environment variables are configured
const isR2Configured = !!(accountId && accessKeyId && secretAccessKey);

let s3Client: S3Client | null = null;

if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
}

export interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  isMock: boolean;
}

/**
 * Generates a presigned PUT URL for uploading screenshots or merchant logos directly from the browser.
 *
 * @param objectKey - Unique target filename key in the bucket
 * @param contentType - MIME type of the uploaded file (e.g. image/png)
 * @param expiresInSeconds - validity window (default 15 minutes)
 * @returns Upload endpoint, public read endpoint, and fallback status
 */
export async function getPresignedUploadUrl(
  objectKey: string,
  contentType: string,
  expiresInSeconds: number = 900
): Promise<PresignedUrlResult> {
  const finalPublicUrl = publicUrl
    ? `${publicUrl.replace(/\/$/, '')}/${objectKey}`
    : `/api/mock-uploads/${objectKey}`;

  if (!s3Client) {
    console.warn(`[R2 Storage] Missing Cloudflare R2 credentials. Simulating mock presigned URL for key: ${objectKey}`);
    return {
      uploadUrl: `/api/mock-upload-receiver?key=${encodeURIComponent(objectKey)}`,
      publicUrl: finalPublicUrl,
      isMock: true,
    };
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      uploadUrl,
      publicUrl: finalPublicUrl,
      isMock: false,
    };
  } catch (error) {
    console.error('[R2 Storage] Failed to generate presigned S3 url, falling back to mock:', error);
    return {
      uploadUrl: `/api/mock-upload-receiver?key=${encodeURIComponent(objectKey)}`,
      publicUrl: finalPublicUrl,
      isMock: true,
    };
  }
}

/**
 * Validates the first few bytes of a buffer to match standard image signatures.
 */
export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return true;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }

  // GIF: 47 49 46 38 ('GIF8')
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return true;
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}

/**
 * Fetches the first 16 bytes of an object from R2 and verifies its image signature.
 */
export async function validateObjectMagicBytes(objectKey: string): Promise<boolean> {
  // If S3 Client is not configured, we simulate validation success
  if (!s3Client) {
    console.log(`[R2 Storage Mock] Assuming magic bytes validation success for key: ${objectKey}`);
    return true;
  }

  try {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Range: 'bytes=0-15',
    });

    const response = await s3Client.send(command);
    if (!response.Body) return false;

    const bytes = await response.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);

    return validateImageMagicBytes(buffer);
  } catch (error) {
    console.error('[R2 Storage] Magic bytes validation failed:', error);
    return false;
  }
}

