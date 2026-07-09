/**
 * HollowPay — Export & Reporting Service
 *
 * Generates CSV reports for orders, payments, and claims data.
 * Handles proper CSV escaping and serialization.
 */

import { db } from '@/lib/db';
import { orders, paymentAttempts, paymentClaims, customers } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────
// CSV Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Escapes a single CSV cell value.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts headers + rows into a complete CSV string.
 */
export function toCsvString(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// ─────────────────────────────────────────────────────────────
// Orders Export
// ─────────────────────────────────────────────────────────────

export async function exportOrdersCsv(projectId: number, environment: string): Promise<string> {
  const results = await db
    .select({
      publicId: orders.publicId,
      status: orders.status,
      amountMinor: orders.amountMinor,
      currency: orders.currency,
      merchantOrderId: orders.merchantOrderId,
      description: orders.description,
      customerName: customers.name,
      customerEmail: customers.email,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.projectId, projectId), eq(orders.environment, environment)))
    .orderBy(desc(orders.createdAt))
    .limit(5000);

  const headers = [
    'Order ID',
    'Status',
    'Amount (Minor Units)',
    'Currency',
    'Merchant Order ID',
    'Description',
    'Customer Name',
    'Customer Email',
    'Created At',
    'Updated At',
  ];

  const rows = results.map((r) => [
    r.publicId,
    r.status,
    String(r.amountMinor),
    r.currency,
    r.merchantOrderId || '',
    r.description || '',
    r.customerName || '',
    r.customerEmail || '',
    r.createdAt ? new Date(r.createdAt).toISOString() : '',
    r.updatedAt ? new Date(r.updatedAt).toISOString() : '',
  ]);

  return toCsvString(headers, rows);
}

// ─────────────────────────────────────────────────────────────
// Payments (Attempts) Export
// ─────────────────────────────────────────────────────────────

export async function exportPaymentsCsv(projectId: number, environment: string): Promise<string> {
  const results = await db
    .select({
      publicId: paymentAttempts.publicId,
      orderId: orders.publicId,
      status: paymentAttempts.status,
      amountMinor: paymentAttempts.amountMinor,
      currency: paymentAttempts.currency,
      createdAt: paymentAttempts.createdAt,
      updatedAt: paymentAttempts.updatedAt,
    })
    .from(paymentAttempts)
    .leftJoin(orders, eq(paymentAttempts.orderId, orders.id))
    .where(and(eq(paymentAttempts.projectId, projectId), eq(paymentAttempts.environment, environment)))
    .orderBy(desc(paymentAttempts.createdAt))
    .limit(5000);

  const headers = [
    'Payment ID',
    'Order ID',
    'Status',
    'Amount (Minor Units)',
    'Currency',
    'Created At',
    'Updated At',
  ];

  const rows = results.map((r) => [
    r.publicId,
    r.orderId || '',
    r.status,
    String(r.amountMinor),
    r.currency,
    r.createdAt ? new Date(r.createdAt).toISOString() : '',
    r.updatedAt ? new Date(r.updatedAt).toISOString() : '',
  ]);

  return toCsvString(headers, rows);
}

// ─────────────────────────────────────────────────────────────
// Claims Export
// ─────────────────────────────────────────────────────────────

export async function exportClaimsCsv(projectId: number, environment: string): Promise<string> {
  const results = await db
    .select({
      publicId: paymentClaims.publicId,
      orderId: orders.publicId,
      claimedReference: paymentClaims.claimedReference,
      status: paymentClaims.status,
      reviewReason: paymentClaims.reviewReason,
      claimedAt: paymentClaims.claimedAt,
      reviewedAt: paymentClaims.reviewedAt,
      createdAt: paymentClaims.createdAt,
    })
    .from(paymentClaims)
    .leftJoin(orders, eq(paymentClaims.orderId, orders.id))
    .where(eq(paymentClaims.projectId, projectId))
    .orderBy(desc(paymentClaims.createdAt))
    .limit(5000);

  const headers = [
    'Claim ID',
    'Order ID',
    'UTR Reference',
    'Status',
    'Review Notes',
    'Claimed At',
    'Reviewed At',
    'Created At',
  ];

  const rows = results.map((r) => [
    r.publicId,
    r.orderId || '',
    r.claimedReference || '',
    r.status,
    r.reviewReason || '',
    r.claimedAt ? new Date(r.claimedAt).toISOString() : '',
    r.reviewedAt ? new Date(r.reviewedAt).toISOString() : '',
    r.createdAt ? new Date(r.createdAt).toISOString() : '',
  ]);

  return toCsvString(headers, rows);
}
