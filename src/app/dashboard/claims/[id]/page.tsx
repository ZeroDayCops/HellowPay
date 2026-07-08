'use client';

/**
 * HollowPay — Claim Detail & Verification Page
 *
 * Displays full claim context (order, payment attempt, screenshot, event timeline)
 * and provides Approve / Reject action buttons for merchant verification.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui';
import { signal } from '@/lib/reticle';
import styles from './page.module.css';

interface ClaimDetail {
  claim: {
    id: number;
    publicId: string;
    status: string;
    claimedReference: string | null;
    screenshotObjectKey: string | null;
    screenshotUrl: string | null;
    claimedAt: string;
    reviewedAt: string | null;
    reviewReason: string | null;
    createdAt: string;
  };
  order: {
    publicId: string;
    amountMinor: number;
    currency: string;
    status: string;
    merchantOrderId: string | null;
    description: string | null;
    createdAt: string;
  };
  attempt: {
    publicId: string;
    status: string;
    amountMinor: number;
    currency: string;
  };
  session: {
    publicId: string;
    status: string;
  } | null;
  transaction: {
    publicId: string;
    confirmationSource: string;
    confirmedAt: string;
  } | null;
  timeline: {
    claimEvents: TimelineEvent[];
    attemptEvents: TimelineEvent[];
    orderEvents: TimelineEvent[];
  };
}

interface TimelineEvent {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  actor: string | null;
  reason: string | null;
  createdAt: string;
}

type ActionResult = {
  type: 'success' | 'rejected' | 'error';
  message: string;
} | null;

export default function ClaimDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const env = searchParams.get('env') === 'live' ? 'live' : 'test';

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ClaimDetail | null>(null);
  const [acting, setActing] = useState(false);
  const [actionResult, setActionResult] = useState<ActionResult>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/claims/${id}?env=${env}`);
      if (!res.ok) {
        throw new Error('Claim not found');
      }
      const json = await res.json();
      setDetail(json);
      signal('claims:loaded', { claimId: id, status: json.claim.status, env });
    } catch (err) {
      console.error('Failed to fetch claim detail:', err);
    } finally {
      setLoading(false);
    }
  }, [id, env]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleAction = async (action: 'approve' | 'reject') => {
    setActing(true);
    setActionResult(null);

    try {
      const res = await fetch(`/api/dashboard/claims/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          env,
          reason: action === 'reject' ? (rejectReason || 'Rejected by merchant') : undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setActionResult({ type: 'error', message: json.error || 'Action failed' });
        return;
      }

      setActionResult({
        type: action === 'approve' ? 'success' : 'rejected',
        message:
          action === 'approve'
            ? `✅ Payment confirmed! Transaction ${json.transactionId} created.`
            : `❌ Claim rejected successfully.`,
      });

      signal('claims:action_completed', { action, claimId: id, env });

      // Refresh detail to show updated state
      await fetchDetail();
    } catch (err) {
      console.error('Action failed:', err);
      setActionResult({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p className="body-sm text-muted-foreground">Loading claim details…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={styles.loadingState}>
        <p className="body-sm text-muted-foreground">Claim not found.</p>
        <button className={styles.backLink} onClick={() => router.push('/dashboard/claims')}>
          ← Back to Claims
        </button>
      </div>
    );
  }

  const { claim, order, attempt, session, transaction, timeline } = detail;
  const isPending = claim.status === 'pending';

  // Merge and sort all timeline events
  const allEvents = [
    ...timeline.claimEvents.map((e) => ({ ...e, category: 'Claim' })),
    ...timeline.attemptEvents.map((e) => ({ ...e, category: 'Payment' })),
    ...timeline.orderEvents.map((e) => ({ ...e, category: 'Order' })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className={styles.detailPage}>
      {/* Back Link */}
      <button className={styles.backLink} onClick={() => router.push('/dashboard/claims')}>
        ← Back to Claims
      </button>

      {/* Header */}
      <div className={styles.detailHeader}>
        <div className={styles.headerLeft}>
          <h1 className="h2">Claim Verification</h1>
          <span className={styles.claimIdTitle}>{claim.publicId}</span>
        </div>
        <div className={styles.headerRight}>
          <Badge
            variant={
              claim.status === 'confirmed'
                ? 'success'
                : claim.status === 'rejected'
                ? 'danger'
                : 'warning'
            }
          >
            {claim.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Action Result Banner */}
      {actionResult && (
        <div
          className={`${styles.resultBanner} ${
            actionResult.type === 'success'
              ? styles.resultBannerSuccess
              : actionResult.type === 'rejected'
              ? styles.resultBannerReject
              : styles.resultBannerError
          }`}
        >
          {actionResult.message}
        </div>
      )}

      {/* Two Column Layout */}
      <div className={styles.detailGrid}>
        {/* LEFT COLUMN: Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Order Details */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>📋 Order Details</div>
            <div className={styles.infoCardBody}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Order ID</span>
                <span className={styles.infoValueMono}>{order.publicId}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Amount</span>
                <span className={styles.infoValueAmount}>
                  {order.currency}{' '}
                  {(order.amountMinor / 100).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Order Status</span>
                <Badge
                  variant={
                    order.status === 'confirmed'
                      ? 'success'
                      : order.status === 'confirmation_pending'
                      ? 'warning'
                      : 'default'
                  }
                >
                  {order.status}
                </Badge>
              </div>
              {order.merchantOrderId && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Merchant Ref</span>
                  <span className={styles.infoValueMono}>{order.merchantOrderId}</span>
                </div>
              )}
              {order.description && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Description</span>
                  <span className={styles.infoValue}>{order.description}</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Created</span>
                <span className={styles.infoValue}>
                  {new Date(order.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Claim Details */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>🔍 Claim Details</div>
            <div className={styles.infoCardBody}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>UTR / Reference</span>
                <span className={styles.infoValueMono}>
                  {claim.claimedReference || '—'}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Claimed At</span>
                <span className={styles.infoValue}>
                  {new Date(claim.claimedAt).toLocaleString()}
                </span>
              </div>
              {claim.reviewedAt && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Reviewed At</span>
                  <span className={styles.infoValue}>
                    {new Date(claim.reviewedAt).toLocaleString()}
                  </span>
                </div>
              )}
              {claim.reviewReason && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Review Note</span>
                  <span className={styles.infoValue}>{claim.reviewReason}</span>
                </div>
              )}
              <div className={styles.divider} />
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Payment Attempt</span>
                <span className={styles.infoValueMono}>{attempt.publicId}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Attempt Status</span>
                <Badge
                  variant={
                    attempt.status === 'confirmed'
                      ? 'success'
                      : attempt.status === 'rejected'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {attempt.status}
                </Badge>
              </div>
              {session && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Checkout Session</span>
                  <span className={styles.infoValueMono}>{session.publicId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Screenshot */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>📷 Payment Screenshot</div>
            <div className={styles.infoCardBody}>
              {claim.screenshotUrl ? (
                <div className={styles.screenshotPreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={claim.screenshotUrl}
                    alt="Payment screenshot"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className={styles.noScreenshot}>
                  No screenshot was attached to this claim.
                </div>
              )}
            </div>
          </div>

          {/* Transaction (if confirmed) */}
          {transaction && (
            <div className={styles.infoCard}>
              <div className={styles.infoCardHeader}>💰 Transaction Record</div>
              <div className={styles.infoCardBody}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Transaction ID</span>
                  <span className={styles.infoValueMono}>{transaction.publicId}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Confirmed By</span>
                  <span className={styles.infoValue}>{transaction.confirmationSource}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Confirmed At</span>
                  <span className={styles.infoValue}>
                    {new Date(transaction.confirmedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Actions + Timeline */}
        <div className={styles.actionPanel}>
          {/* Action Card */}
          {isPending ? (
            <div className={styles.actionCard}>
              <div className={styles.actionCardTitle}>⚡ Verification Actions</div>
              <p className="body-sm text-muted-foreground">
                Review the UTR reference and screenshot above, then confirm or reject this payment claim.
              </p>

              <div className={styles.actionButtons}>
                <button
                  className={styles.approveBtn}
                  onClick={() => handleAction('approve')}
                  disabled={acting}
                  data-testid="claim-approve-btn"
                >
                  {acting ? '…' : '✅'} Approve & Confirm Payment
                </button>

                {!showRejectForm ? (
                  <button
                    className={styles.rejectBtn}
                    onClick={() => setShowRejectForm(true)}
                    disabled={acting}
                    data-testid="claim-reject-btn"
                  >
                    ❌ Reject Claim
                  </button>
                ) : (
                  <div className={styles.rejectReasonField}>
                    <label>Rejection Reason</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="UTR not found in bank statement, screenshot tampered…"
                      data-testid="claim-reject-reason"
                    />
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => handleAction('reject')}
                        disabled={acting}
                        style={{ flex: 1 }}
                      >
                        {acting ? '…' : '❌'} Confirm Rejection
                      </button>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectReason('');
                        }}
                        style={{ flex: 0, padding: 'var(--space-2) var(--space-3)', color: 'var(--foreground-muted)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.completedCard}>
              <div className={styles.completedIcon}>
                {claim.status === 'confirmed' ? '✅' : '❌'}
              </div>
              <div className={styles.completedTitle}>
                {claim.status === 'confirmed'
                  ? 'Payment Confirmed'
                  : 'Claim Rejected'}
              </div>
              <div className={styles.completedSubtitle}>
                {claim.reviewReason || 'No additional notes.'}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className={styles.timelineCard}>
            <div className={styles.timelineHeader}>📜 Event Timeline</div>
            <div className={styles.timelineList}>
              {allEvents.length === 0 ? (
                <p className="body-sm text-muted-foreground" style={{ padding: 'var(--space-2)' }}>
                  No events recorded.
                </p>
              ) : (
                allEvents.map((event) => (
                  <div key={`${event.category}-${event.id}`} className={styles.timelineItem}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineAction}>
                        <Badge variant="default" style={{ fontSize: '0.6rem', marginRight: 6 }}>
                          {event.category}
                        </Badge>
                        {event.reason || 'Status changed'}
                      </div>
                      {event.fromStatus && (
                        <div className={styles.timelineTransition}>
                          {event.fromStatus} → {event.toStatus}
                        </div>
                      )}
                      <div className={styles.timelineMeta}>
                        {event.actor && `by ${event.actor} · `}
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
