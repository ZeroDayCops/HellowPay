/**
 * HollowPay — Public ID Generator
 *
 * Generates secure, prefixed public IDs for all entities.
 * Uses cryptographic randomness via nanoid.
 * Never exposes sequential database IDs.
 */

import { nanoid } from 'nanoid';

/** Entity prefix mapping */
const PREFIXES = {
  workspace: 'ws_hp',
  business: 'biz_hp',
  project: 'proj_hp',
  order: 'ord_hp',
  checkout_session: 'cs_hp',
  payment: 'pay_hp',
  payment_claim: 'claim_hp',
  transaction: 'txn_hp',
  event: 'evt_hp',
  request: 'req_hp',
  webhook_endpoint: 'we_hp',
  api_key_test_pk: 'hp_test_pk',
  api_key_test_sk: 'hp_test_sk',
  api_key_live_pk: 'hp_live_pk',
  api_key_live_sk: 'hp_live_sk',
  webhook_secret: 'whsec_hp',
  payment_page: 'pp_hp',
  customer: 'cust_hp',
  user: 'usr_hp',
  audit: 'aud_hp',
  product: 'prod_hp',
  notification: 'notif_hp',
} as const;

export type EntityType = keyof typeof PREFIXES;

/**
 * Generates a secure, prefixed public ID.
 *
 * @param entity - The entity type to generate an ID for
 * @param length - The length of the random part (default: 24)
 * @returns A prefixed public ID like `ord_hp_xK9q2mZ8nP3w...`
 */
export function generatePublicId(entity: EntityType, length: number = 24): string {
  const prefix = PREFIXES[entity];
  const random = nanoid(length);
  return `${prefix}_${random}`;
}

/**
 * Generates a test-mode prefixed public ID.
 * Adds `test_` between the prefix and the random part.
 *
 * @param entity - The entity type
 * @param length - Random part length
 * @returns e.g. `ord_hp_test_xK9q2mZ8nP3w...`
 */
export function generateTestId(entity: EntityType, length: number = 24): string {
  const prefix = PREFIXES[entity];
  const random = nanoid(length);
  return `${prefix}_test_${random}`;
}

/**
 * Generates an ID appropriate for the given environment.
 */
export function generateEnvironmentId(
  entity: EntityType,
  environment: 'test' | 'live',
  length: number = 24
): string {
  return environment === 'test'
    ? generateTestId(entity, length)
    : generatePublicId(entity, length);
}

/**
 * Generates a request ID for API logging.
 */
export function generateRequestId(): string {
  return generatePublicId('request', 20);
}

/**
 * Extracts the prefix from a public ID.
 */
export function extractPrefix(publicId: string): string | null {
  for (const prefix of Object.values(PREFIXES)) {
    if (publicId.startsWith(prefix + '_')) {
      return prefix;
    }
  }
  return null;
}

/**
 * Checks if a public ID is a test mode ID.
 */
export function isTestId(publicId: string): boolean {
  return publicId.includes('_test_');
}
