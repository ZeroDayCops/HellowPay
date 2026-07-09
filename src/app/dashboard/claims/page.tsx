'use client';

/**
 * HollowPay — Claims Verification Dashboard
 *
 * Displays pending payment claims for manual merchant verification.
 * Supports filtering by status, pagination, and click-through to detail.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Badge } from '@/components/ui';
import { signal } from '@/lib/reticle';
import styles from './page.module.css';

interface ClaimRow {
  claimId: number;
  claimPublicId: string;
  claimStatus: string;
  claimedReference: string | null;
  screenshotObjectKey: string | null;
  claimedAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
  orderPublicId: string;
  orderAmountMinor: number;
  orderCurrency: string;
  orderStatus: string;
  orderDescription: string | null;
  attemptPublicId: string;
  attemptStatus: string;
  sessionPublicId: string | null;
}

interface ClaimsResponse {
  claims: ClaimRow[];
  total: number;
  page: number;
  limit: number;
  summary: Record<string, number>;
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'rejected';

export default function ClaimsDashboardPage() {
  const router = useRouter();
  const { environment } = useEnvironment();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClaimsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClaims = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        env: environment,
        page: String(page),
        limit: '20',
      });
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/dashboard/claims?${params}`);
      const json = await res.json();
      setData(json);
      signal('claims:loaded', { total: json.total, env: environment, filter: statusFilter });
    } catch (err) {
      console.error('Failed to fetch claims:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [environment, page, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [environment, statusFilter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const totalAll = data?.summary
    ? Object.values(data.summary).reduce((a, b) => a + b, 0)
    : 0;

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p className="body-sm text-muted-foreground">Loading claims…</p>
      </div>
    );
  }

  return (
    <div className={styles.claimsPage}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className="h2">
            <span>🔍</span> Claims Verification
          </h1>
          <p className="body-sm mt-1 text-muted-foreground">
            Review and verify customer payment claims in{' '}
            <strong style={{ textTransform: 'uppercase' }}>{environment}</strong> mode.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={() => {
              const a = document.createElement('a');
              a.href = `/api/dashboard/export/claims?env=${environment}`;
              a.download = '';
              a.click();
            }}
          >
            📥 Export CSV
          </button>
          <button
            className={`${styles.refreshBtn} ${refreshing ? styles.spinning : ''}`}
            onClick={() => fetchClaims(true)}
            disabled={refreshing}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Filter Cards */}
      <div className={styles.summaryGrid}>
        <div
          className={`${styles.summaryCard} ${styles.summaryCardAll} ${statusFilter === 'all' ? styles.summaryCardActive : ''}`}
          onClick={() => setStatusFilter('all')}
          data-testid="claims-filter-all"
        >
          <div className={styles.summaryLabel}>All Claims</div>
          <div className={styles.summaryCount}>{totalAll}</div>
        </div>
        <div
          className={`${styles.summaryCard} ${styles.summaryCardPending} ${statusFilter === 'pending' ? styles.summaryCardActive : ''}`}
          onClick={() => setStatusFilter('pending')}
          data-testid="claims-filter-pending"
        >
          <div className={styles.summaryLabel}>⏳ Pending Review</div>
          <div className={styles.summaryCount}>{data?.summary?.pending ?? 0}</div>
        </div>
        <div
          className={`${styles.summaryCard} ${styles.summaryCardConfirmed} ${statusFilter === 'confirmed' ? styles.summaryCardActive : ''}`}
          onClick={() => setStatusFilter('confirmed')}
          data-testid="claims-filter-confirmed"
        >
          <div className={styles.summaryLabel}>✅ Confirmed</div>
          <div className={styles.summaryCount}>{data?.summary?.confirmed ?? 0}</div>
        </div>
        <div
          className={`${styles.summaryCard} ${styles.summaryCardRejected} ${statusFilter === 'rejected' ? styles.summaryCardActive : ''}`}
          onClick={() => setStatusFilter('rejected')}
          data-testid="claims-filter-rejected"
        >
          <div className={styles.summaryLabel}>❌ Rejected</div>
          <div className={styles.summaryCount}>{data?.summary?.rejected ?? 0}</div>
        </div>
      </div>

      {/* Claims Table */}
      <div className={styles.tableSection}>
        {data?.claims.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <div className={styles.emptyTitle}>
              {statusFilter === 'all'
                ? 'No claims yet'
                : `No ${statusFilter} claims`}
            </div>
            <div className={styles.emptyDescription}>
              {statusFilter === 'all'
                ? 'Payment claims from customers will appear here once they submit a UTR reference through the hosted checkout.'
                : `There are no claims with "${statusFilter}" status in ${environment} mode.`}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table} data-testid="claims-table">
                <thead>
                  <tr>
                    <th>Claim ID</th>
                    <th>Order</th>
                    <th>Amount</th>
                    <th>UTR / Reference</th>
                    <th>Screenshot</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.claims.map((claim) => (
                    <tr
                      key={claim.claimPublicId}
                      className={styles.claimRow}
                      onClick={() =>
                        router.push(
                          `/dashboard/claims/${claim.claimPublicId}?env=${environment}`
                        )
                      }
                    >
                      <td>
                        <div className={styles.claimIdCell}>
                          <span className={styles.claimIdCode}>
                            {claim.claimPublicId.substring(0, 16)}…
                          </span>
                        </div>
                      </td>
                      <td>
                        <code className="monospace" style={{ fontSize: '0.75rem' }}>
                          {claim.orderPublicId.substring(0, 16)}…
                        </code>
                      </td>
                      <td className={styles.amountCell}>
                        {claim.orderCurrency}{' '}
                        {(claim.orderAmountMinor / 100).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className={styles.referenceCell}>
                        {claim.claimedReference || '—'}
                      </td>
                      <td>
                        {claim.screenshotObjectKey ? (
                          <span className={styles.screenshotIndicator} title="Screenshot attached">
                            📷
                          </span>
                        ) : (
                          <span className={styles.noScreenshot}>—</span>
                        )}
                      </td>
                      <td>
                        <Badge
                          variant={
                            claim.claimStatus === 'confirmed'
                              ? 'success'
                              : claim.claimStatus === 'rejected'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {claim.claimStatus}
                        </Badge>
                      </td>
                      <td className={styles.dateCell}>
                        {new Date(claim.claimedAt).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td>
                        <span className={styles.actionChevron}>→</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <div className={styles.paginationInfo}>
                  Page {page} of {totalPages} · {data?.total} total claims
                </div>
                <div className={styles.paginationButtons}>
                  <button
                    className={styles.paginationBtn}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    className={styles.paginationBtn}
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
