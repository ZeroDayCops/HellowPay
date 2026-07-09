'use client';

/**
 * HollowPay — Payments Attempts Transaction Audit Dashboard
 *
 * Lists all peer-to-peer claims, banking verification codes (UTRs),
 * payment states, and buyer emails.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge, Button } from '@/components/ui';
import styles from '../developers/api-logs/page.module.css'; // Reuse table list card styles
import { formatCurrency } from '@/lib/utils/currency-formatter';

interface PaymentAttemptRow {
  attempt: {
    id: number;
    publicId: string;
    status: string;
    amountMinor: number;
    currency: string;
    createdAt: string;
  };
  order: {
    publicId: string;
    description: string | null;
  };
  claim: {
    claimedReference: string | null;
    status: string | null;
  } | null;
  customer: {
    name: string;
    email: string;
  } | null;
}

export default function PaymentsListConsole() {
  const { environment } = useEnvironment();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentAttemptRow[]>([]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/payments?env=${environment}`);
      const json = await res.json();
      if (res.ok) {
        setPayments(json.payments || []);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const formatAmount = (minor: number, currency: string = 'INR') => {
    return formatCurrency(minor, currency);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'confirmed' || s === 'success') {
      return <span style={{ color: '#10b981', fontWeight: 'bold' }}>● Confirmed</span>;
    }
    if (s === 'claimed') {
      return <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>● Claimed</span>;
    }
    if (s === 'rejected' || s === 'failed') {
      return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>● Rejected</span>;
    }
    return <span style={{ color: '#6b7280' }}>● Pending QR</span>;
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">💰 Payments</h1>
          <p className="body-sm text-muted-foreground mt-1">
            Audit and verify incoming buyer UPI transaction claims and status changes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="secondary"
            onClick={() => {
              const a = document.createElement('a');
              a.href = `/api/dashboard/export/payments?env=${environment}`;
              a.download = '';
              a.click();
            }}
          >
            📥 Export CSV
          </Button>
          <Button variant="secondary" onClick={fetchPayments}>
            🔄 Refresh
          </Button>
        </div>
      </div>

      <div className={styles.tableCard}>
        {loading && payments.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p className="body-sm text-muted-foreground mt-2">Loading transactions...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className={styles.emptyState}>No payments recorded in {environment} mode.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Attempt ID</th>
                  <th>Customer</th>
                  <th>Order Ref</th>
                  <th>UTR Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const date = new Date(p.attempt.createdAt);
                  return (
                    <tr key={p.attempt.id}>
                      <td>
                        <code className="monospace" style={{ fontSize: '0.75rem' }}>
                          {p.attempt.publicId.substring(0, 15)}...
                        </code>
                      </td>
                      <td>
                        {p.customer ? (
                          <div>
                            <div className="body-xs" style={{ fontWeight: '600' }}>{p.customer.name}</div>
                            <div className="caption text-muted-foreground" style={{ fontSize: '0.65rem' }}>{p.customer.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td>
                        <code className="monospace" style={{ fontSize: '0.75rem' }}>
                          {p.order.publicId.substring(0, 12)}...
                        </code>
                      </td>
                      <td>
                        {p.claim?.claimedReference ? (
                          <code className="monospace" style={{ fontWeight: '600', color: '#fff' }}>
                            {p.claim.claimedReference}
                          </code>
                        ) : (
                          <span className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>No proof submitted</span>
                        )}
                      </td>
                       <td className="monospace" style={{ fontWeight: 'bold' }}>
                        {formatAmount(p.attempt.amountMinor, p.attempt.currency)}
                      </td>
                      <td>{getStatusBadge(p.attempt.status)}</td>
                      <td className="caption text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                        {date.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
