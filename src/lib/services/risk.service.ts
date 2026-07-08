/**
 * HollowPay — Risk & Fraud Checking Service
 */

import { db } from '@/lib/db';
import { riskEvents, paymentClaims, checkoutSessions } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { sendMerchantNotification, sendFounderNotification } from './notification.service';

const ipCache = new Map<string, number[]>();

export interface RiskEventData {
  projectId: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
}

/**
 * Creates a risk event log entry in the database.
 * Sends notifications to merchant and founders if severity is HIGH or CRITICAL.
 */
export async function createRiskEvent(data: RiskEventData): Promise<any> {
  const [event] = await db
    .insert(riskEvents)
    .values({
      projectId: data.projectId,
      type: data.type,
      severity: data.severity,
      details: data.details || null,
    })
    .returning();

  // Send notifications for high or critical severities
  if (data.severity === 'high' || data.severity === 'critical') {
    // 1. Notify merchant workspace members
    await sendMerchantNotification(
      data.projectId,
      'suspicious_activity',
      'Suspicious account activity detected',
      `Suspicious activity of type "${data.type.toUpperCase()}" flagged. Severity: ${data.severity.toUpperCase()}.`,
      `/dashboard/developers/risk-events`
    );

    // 2. Notify system administrators (founders)
    await sendFounderNotification(
      'risk_event',
      'Risk event flagged',
      `Risk alert of severity ${data.severity.toUpperCase()} triggered on project ID ${data.projectId}.`,
      `/admin/live-mode` // Administrative dashboard
    );
  }

  return event;
}

/**
 * Checks if the UTR reference is already claimed elsewhere.
 * Logs a high-severity event if reused across different checkouts.
 */
export async function checkUtrDuplicateRisk(
  projectId: number,
  utr: string,
  checkoutSessionId: number
): Promise<void> {
  const trimmedUtr = utr.trim();

  // Find any existing claims with the same UTR in this project
  const duplicateClaims = await db
    .select({
      id: paymentClaims.id,
      checkoutSessionId: paymentClaims.checkoutSessionId,
      status: paymentClaims.status,
    })
    .from(paymentClaims)
    .where(
      and(
        eq(paymentClaims.projectId, projectId),
        eq(paymentClaims.claimedReference, trimmedUtr),
        ne(paymentClaims.status, 'rejected') // Ignore already rejected claims
      )
    );

  if (duplicateClaims.length > 0) {
    const isDifferentSession = duplicateClaims.some(
      (c) => c.checkoutSessionId !== checkoutSessionId
    );

    if (isDifferentSession) {
      // High severity fraud attempt: claiming different orders with same UTR
      await createRiskEvent({
        projectId,
        type: 'duplicate_utr_reuse',
        severity: 'high',
        details: {
          utr: trimmedUtr,
          checkoutSessionId,
          conflictingClaims: duplicateClaims,
        },
      });
      throw new Error('This UTR transaction reference has already been claimed for another order.');
    } else {
      // Medium severity: duplicate claim attempt on the same checkout
      await createRiskEvent({
        projectId,
        type: 'duplicate_claim_attempt',
        severity: 'medium',
        details: {
          utr: trimmedUtr,
          checkoutSessionId,
        },
      });
      throw new Error('A payment claim with this UTR has already been submitted for this order.');
    }
  }
}

/**
 * Checks client IP address claim velocity.
 * Logs a medium-severity event if exceeding limit.
 */
export async function checkIpVelocityRisk(
  projectId: number,
  ipAddress: string
): Promise<void> {
  const now = Date.now();
  const windowMs = 120000; // 2 minutes window
  const limit = 5; // Max 5 claims in window

  const timestamps = ipCache.get(ipAddress) || [];
  const activeTimestamps = timestamps.filter((ts) => now - ts < windowMs);
  
  activeTimestamps.push(now);
  ipCache.set(ipAddress, activeTimestamps);

  if (activeTimestamps.length > limit) {
    // Log velocity warning
    await createRiskEvent({
      projectId,
      type: 'ip_velocity_abuse',
      severity: 'medium',
      details: {
        ipAddress,
        claimCount: activeTimestamps.length,
        timeWindowMs: windowMs,
      },
    });
    throw new Error('Too many checkout claim attempts from this IP address. Please wait a few minutes.');
  }
}
