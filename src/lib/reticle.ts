/**
 * HollowPay — Reticle Signal Helper
 *
 * Dev-only wrapper for emitting Reticle signals from any component or service.
 * In production, the function is a no-op — `@reticlehq/core` is never imported.
 *
 * Usage:
 *   import { signal } from '@/lib/reticle';
 *   signal('checkout:claim_submitted', { orderId: 'ord_123', utr: '123456789012' });
 *
 * @see https://github.com/reticlehq/reticle/blob/main/docs/usage.md
 */

/**
 * Emit a named signal with optional structured data for Reticle verification.
 * No-op in production builds (dead-code eliminated by bundler).
 */
export function signal(name: string, data?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'development') return;
  void import('@reticlehq/core').then((mod: any) => mod.reticle.signal(name, data));
}
