/**
 * HollowPay — API Key Generator & Verifier
 *
 * Generates and validates publishable and secret API keys.
 * Uses SHA-256 for hashing keys for fast, constant-time database lookups.
 */

import crypto from 'crypto';

export interface GeneratedApiKey {
  /** The full key to display to the user ONCE (e.g. `hp_test_sk_123456...`) */
  key: string;
  /** First few chars of the key (e.g. `hp_test_sk`) */
  prefix: string;
  /** Last 4 characters of the key (e.g. `abcd`) */
  lastFour: string;
  /** SHA-256 hash of the key to store in the database */
  keyHash: string;
}

/**
 * Generates an API key payload for a given environment and type.
 *
 * Prefix formats:
 * - Test Publishable: `hp_test_pk`
 * - Test Secret: `hp_test_sk`
 * - Live Publishable: `hp_live_pk`
 * - Live Secret: `hp_live_sk`
 */
export function generateApiKey(
  environment: 'test' | 'live',
  type: 'publishable' | 'secret'
): GeneratedApiKey {
  // Generate random part (36 chars)
  const randomPart = crypto.randomBytes(24).toString('base64url'); // ~32 chars
  
  // Prefix
  const prefix = type === 'publishable' 
    ? `hp_${environment}_pk` 
    : `hp_${environment}_sk`;
    
  const key = `${prefix}_${randomPart}`;
  const lastFour = key.slice(-4);
  const keyHash = hashApiKey(key);

  return {
    key,
    prefix,
    lastFour,
    keyHash,
  };
}

/**
 * Hashes a raw API key using SHA-256 for secure database lookup.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validates a key structure.
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key.startsWith('hp_')) return false;
  const parts = key.split('_');
  if (parts.length < 4) return false;
  
  const [hp, env, type] = parts;
  if (hp !== 'hp') return false;
  if (env !== 'test' && env !== 'live') return false;
  if (type !== 'pk' && type !== 'sk') return false;
  
  return true;
}

/**
 * Helper to check key type without DB lookup.
 */
export function getApiKeyMetadata(key: string) {
  if (!isValidApiKeyFormat(key)) return null;
  const parts = key.split('_');
  return {
    environment: parts[1] as 'test' | 'live',
    type: parts[2] === 'pk' ? 'publishable' : 'secret' as 'publishable' | 'secret',
  };
}
