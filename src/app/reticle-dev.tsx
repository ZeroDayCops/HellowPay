'use client';

/**
 * HollowPay — Reticle Dev-Only Integration
 *
 * This component bootstraps the Reticle proof layer in development mode.
 * Reticle instruments the running app (DOM, network, console, store state)
 * and feeds the AI coding agent structured verdicts instead of screenshots.
 *
 * - Dev-only: tree-shaken out of production builds
 * - Localhost-only: no telemetry, no external connections
 * - Registers capabilities: testids, signals, and stores for agent legibility
 *
 * @see https://github.com/reticlehq/reticle
 */

import { useEffect } from 'react';

export function ReticleDev() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    void (import('@reticlehq/core') as Promise<any>).then(
      ({ reticle, install, registerCapabilities }) => {
        // Install React component → file:line source mapping
        install();

        // Connect to the local Reticle bridge daemon (ws://localhost:4400)
        reticle.connect({ session: 'hollowpay' });

        // Register testable surface for agent discovery
        registerCapabilities({
          testids: [
            // Auth
            'sign-in-btn',
            'sign-up-btn',
            // Onboarding
            'onboarding-wizard',
            'onboarding-next-btn',
            'onboarding-submit-btn',
            // Dashboard
            'env-selector',
            'nav-overview',
            'nav-claims',
            'nav-payments',
            'nav-orders',
            // Claims Verification
            'claims-table',
            'claims-filter-all',
            'claims-filter-pending',
            'claims-filter-confirmed',
            'claims-filter-rejected',
            'claim-approve-btn',
            'claim-reject-btn',
            'claim-reject-reason',
            // Checkout
            'checkout-utr-input',
            'checkout-submit-btn',
            'checkout-screenshot-upload',
            // Metrics
            'metric-volume',
            'metric-confirmed',
            'metric-pending',
          ],
          signals: [
            // Payment flow signals
            'checkout:opened',
            'checkout:claim_submitted',
            'checkout:payment_confirmed',
            'checkout:payment_rejected',
            // Dashboard signals
            'claims:loaded',
            'claims:action_completed',
            'dashboard:metrics_loaded',
            // Onboarding signals
            'onboarding:step_completed',
            'onboarding:finished',
          ],
          stores: [],
        });
      }
    );
  }, []);

  return null;
}
