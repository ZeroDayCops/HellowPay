/**
 * HollowPay — Cryptographic Hash Utilities
 *
 * Lightweight, dependency-free hashing functions using Node.js crypto.
 */

import crypto from 'crypto';

/**
 * Creates a SHA-256 hash of a string.
 */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Creates an MD5 hash of a string (mostly for Gravatar support).
 */
export function md5(value: string): string {
  return crypto.createHash('md5').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Generates a random secure token.
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Constant-time string comparison helper to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}
