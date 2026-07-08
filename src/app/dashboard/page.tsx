'use client';

/**
 * HollowPay — Dashboard Overview
 *
 * Renders merchant-specific metrics and recent payments dynamically.
 * Synchronizes with the sidebar's environment selector and redirects to onboarding if needed.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge } from '@/components/ui';
import styles from './page.module.css';

interface DashboardMetrics {
  confirmedVolume: number;
  confirmedCount: number;
  pendingCount: number;
}

interface RecentPayment {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { environment } = useEnvironment();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/metrics?env=${environment}`);
        const data = await res.json();

        if (data.onboarded === false) {
          // Redirect to onboarding if not configured
          router.push('/dashboard/onboarding');
          return;
        }

        setMetrics(data.metrics);
        setRecentPayments(data.recentPayments || []);
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [environment, router]);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p className="body-sm mt-3 text-muted-foreground">Loading workspace details...</p>
      </div>
    );
  }

  const volume = metrics?.confirmedVolume ?? 0;
  const count = metrics?.confirmedCount ?? 0;
  const pending = metrics?.pendingCount ?? 0;

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h1 className="h2">Overview</h1>
        <p className="body-sm mt-1 text-muted-foreground">
          Welcome to HollowPay. Here&apos;s what&apos;s happening in your{' '}
          <strong style={{ textTransform: 'uppercase' }}>{environment}</strong> environment.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        <Card className={styles.metricCard}>
          <div className="caption">Confirmed Volume</div>
          <div className={styles.metricValue}>
            ₹{volume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="caption mt-2 text-muted-foreground">Direct-to-UPI settled volume</div>
        </Card>

        <Card className={styles.metricCard}>
          <div className="caption">Confirmed Payments</div>
          <div className={styles.metricValue}>{count}</div>
          <div className="caption mt-2 text-muted-foreground">Transactions approved</div>
        </Card>

        <Card className={styles.metricCard}>
          <div className="caption">Awaiting Confirmation</div>
          <div className={styles.metricValue}>{pending}</div>
          <div className="caption mt-2 text-muted-foreground">Pending manual verification</div>
        </Card>

        <Card className={styles.metricCard}>
          <div className="caption">HollowPay Fees Saved</div>
          <div className={styles.metricValueGreen}>
            ₹{((volume * 0.02) + (count * 2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="caption mt-2 text-success-foreground">
            Platform charges saved vs. Stripe (approx 2% + ₹2)
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h3 className="h4">Get Started</h3>
        <div className={styles.actionCards}>
          <Card
            className={`${styles.actionCard} card-hover`}
            onClick={() => router.push('/dashboard/payment-pages')}
          >
            <div className={styles.actionIcon}>📄</div>
            <h4 className="h4 mt-2">Create Payment Page</h4>
            <p className="body-sm mt-2 text-muted-foreground">
              Accept payments without writing code. Create and share a custom payment checkout page.
            </p>
          </Card>
          <Card
            className={`${styles.actionCard} card-hover`}
            onClick={() => router.push('/dashboard/developers/api-keys')}
          >
            <div className={styles.actionIcon}>🔑</div>
            <h4 className="h4 mt-2">View API Keys</h4>
            <p className="body-sm mt-2 text-muted-foreground">
              Copy your environment publishable & secret keys to start integrating Hosted Checkout.
            </p>
          </Card>
          <Card
            className={`${styles.actionCard} card-hover`}
            onClick={() => router.push('/dashboard/developers/webhooks')}
          >
            <div className={styles.actionIcon}>🔗</div>
            <h4 className="h4 mt-2">Configure Webhooks</h4>
            <p className="body-sm mt-2 text-muted-foreground">
              Add webhook endpoints to automate order fulfillment and receive payment confirmations.
            </p>
          </Card>
        </div>
      </div>

      {/* Recent Payments Section */}
      <div className={styles.recentSection}>
        <h3 className="h4">Recent Payments</h3>
        {recentPayments.length === 0 ? (
          <div className="empty-state mt-4">
            <div className="empty-state-icon">◌</div>
            <p className="body-sm">No payments found in {environment} mode.</p>
            <p className="caption mt-1">
              Create an order via API or share a Payment Page link to receive claims.
            </p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order Public ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <code className="monospace">{payment.id}</code>
                    </td>
                    <td>
                      {payment.currency} {(payment.amountMinor / 100).toFixed(2)}
                    </td>
                    <td>
                      <Badge
                        variant={
                          payment.status === 'confirmed'
                            ? 'success'
                            : payment.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {payment.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td>{new Date(payment.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
