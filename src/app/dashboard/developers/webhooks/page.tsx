'use client';

/**
 * HollowPay — Developer Webhook Management Dashboard
 *
 * Provides CRUD management for webhook endpoints, subscription event selectors,
 * custom endpoint signing secrets, live payload testing, and detailed transmission delivery logs.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge, Button, Input } from '@/components/ui';
import { signal } from '@/lib/reticle';
import styles from './page.module.css';

interface WebhookEndpoint {
  id: number;
  publicId: string;
  url: string;
  environment: string;
  secretLastFour: string;
  description: string | null;
  status: string;
  createdAt: string;
  subscriptions: string[];
}

interface DeliveryLog {
  deliveryId: number;
  deliveryStatus: string;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  eventPublicId: string;
  eventType: string;
  eventCreatedAt: string;
  attempts: Array<{
    id: number;
    attemptNumber: number;
    requestedAt: string;
    responseStatus: number | null;
    durationMs: number | null;
    responseExcerpt: string | null;
    error: string | null;
  }>;
}

export default function WebhooksSettingsPage() {
  const { environment } = useEnvironment();

  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [retryingIds, setRetryingIds] = useState<number[]>([]);

  // Modals / forms state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['payment.confirmed']);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Secret reveal state
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRotatedSecret, setIsRotatedSecret] = useState(false);

  // Metrics states
  const [metrics, setMetrics] = useState<{
    totalAttempts: number;
    successRate: number;
    avgLatency: number;
    failuresCount: number;
  } | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUrl, setEditUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  // Testing hook state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    delivery: {
      url: string;
      status: number | string;
      latency_ms: number;
      responseExcerpt: string | null;
      errorMessage: string | null;
    };
  } | null>(null);

  // Simulator states
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [selectedSimEvent, setSelectedSimEvent] = useState('claim.created');
  const [simResult, setSimResult] = useState<{
    url: string;
    eventType: string;
    payload: any;
    response: {
      status: number;
      durationMs: number;
      body: string;
      headers: Record<string, string>;
    };
  } | null>(null);

  // Active delivery excerpt modal state
  const [activeExcerpt, setActiveExcerpt] = useState<string | null>(null);

  // Fetch endpoints
  const fetchEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/webhooks?env=${environment}`);
      const json = await res.json();
      if (res.ok) {
        setEndpoints(json.endpoints || []);
        if (json.endpoints && json.endpoints.length > 0) {
          // Keep current selection or default to first
          const current = json.endpoints.find(
            (e: WebhookEndpoint) => e.publicId === selectedEndpoint?.publicId
          );
          setSelectedEndpoint(current || json.endpoints[0]);
        } else {
          setSelectedEndpoint(null);
        }
      }
    } catch (err) {
      console.error('Failed to load webhook endpoints:', err);
    } finally {
      setLoading(false);
    }
  }, [environment, selectedEndpoint?.publicId]);

  // Fetch metrics helper
  const fetchMetrics = useCallback(async (epId: string) => {
    setLoadingMetrics(true);
    try {
      const res = await fetch(`/api/dashboard/webhooks/${epId}/metrics`);
      const json = await res.json();
      if (res.ok) {
        setMetrics(json.metrics);
      } else {
        setMetrics(null);
      }
    } catch (err) {
      console.error('Failed to load webhook metrics:', err);
      setMetrics(null);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  const handleRotateSecret = async (epId: string) => {
    if (!confirm('Are you sure you want to rotate the signing secret for this webhook? All client integrations must be updated immediately with the new secret.')) {
      return;
    }
    setRotating(true);
    try {
      const res = await fetch(`/api/dashboard/webhooks/${epId}/rotate`, {
        method: 'POST'
      });
      const json = await res.json();
      if (res.ok) {
        setCreatedSecret(json.rawSecret);
        setIsRotatedSecret(true);
        setShowCreateModal(true);
        // Refresh endpoints
        await fetchEndpoints();
      } else {
        alert(json.error || 'Failed to rotate webhook secret.');
      }
    } catch (err) {
      console.error(err);
      alert('Network connection error.');
    } finally {
      setRotating(false);
    }
  };

  // Fetch deliveries logs for selected endpoint
  const fetchDeliveries = useCallback(async (epId: string) => {
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`/api/dashboard/webhooks/${epId}/deliveries?env=${environment}`);
      const json = await res.json();
      if (res.ok) {
        setDeliveries(json.deliveries || []);
      }
    } catch (err) {
      console.error('Failed to load webhook logs:', err);
    } finally {
      setLoadingDeliveries(false);
    }
  }, [environment]);

  const handleRetryDelivery = async (deliveryId: number) => {
    if (!selectedEndpoint) return;
    setRetryingIds((prev) => [...prev, deliveryId]);
    try {
      const res = await fetch(
        `/api/dashboard/webhooks/${selectedEndpoint.publicId}/deliveries/${deliveryId}/retry?env=${environment}`,
        { method: 'POST' }
      );
      const json = await res.json();
      if (res.ok) {
        fetchDeliveries(selectedEndpoint.publicId);
      } else {
        alert(json.error || 'Failed to retry webhook delivery.');
      }
    } catch (err) {
      console.error(err);
      alert('Network connection error.');
    } finally {
      setRetryingIds((prev) => prev.filter((id) => id !== deliveryId));
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, [environment]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedEndpoint) {
      fetchDeliveries(selectedEndpoint.publicId);
      fetchMetrics(selectedEndpoint.publicId);
      setTestResult(null);
    } else {
      setDeliveries([]);
      setMetrics(null);
    }
  }, [selectedEndpoint, fetchDeliveries, fetchMetrics]);

  // Toggle events selection
  const handleEventToggle = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  // Submit webhook configuration
  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl.trim(),
          description: newDescription.trim(),
          event_types: selectedEvents,
          env: environment,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create webhook endpoint.');
      }

      setCreatedSecret(json.endpoint.rawSecret);
      setNewUrl('');
      setNewDescription('');
      setSelectedEvents(['payment.confirmed']);
      await fetchEndpoints();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setCreating(false);
    }
  };

  // Delete/Revoke Webhook Endpoint
  const handleDeleteEndpoint = async (epId: string) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint? You will stop receiving events at this URL.')) {
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/webhooks/${epId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSelectedEndpoint(null);
        await fetchEndpoints();
      }
    } catch (err) {
      console.error('Failed to delete webhook endpoint:', err);
    }
  };

  // Trigger test delivery request
  const handleTestEndpoint = async (epId: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/dashboard/webhooks/${epId}/test`, {
        method: 'POST',
      });
      const json = await res.json();
      setTestResult(json);
      // Refresh deliveries table
      await fetchDeliveries(epId);
    } catch (err) {
      console.error('Test payload trigger failed:', err);
    } finally {
      setTesting(false);
    }
  };

  // Trigger simulated event delivery request
  const handleSimulateEvent = async () => {
    if (!selectedEndpoint) return;
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch(`/api/dashboard/webhooks/${selectedEndpoint.id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedSimEvent }),
      });
      const json = await res.json();
      setSimResult(json);
      // Refresh deliveries table
      await fetchDeliveries(selectedEndpoint.publicId);
    } catch (err) {
      console.error('Simulation trigger failed:', err);
    } finally {
      setSimulating(false);
    }
  };

  // Copy secret key helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && endpoints.length === 0) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p className="body-sm text-muted-foreground">Loading webhook configurations…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>🔗</span> Webhook Endpoints
          </h1>
          <p className="body-sm mt-1 text-muted-foreground">
            Configure URL destinations to receive real-time, cryptographically signed HTTP event payloads.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          ➕ Add Endpoint
        </Button>
      </div>

      {/* Main layout */}
      <div className={styles.layoutGrid}>
        {/* LEFT COLUMN: Endpoints List */}
        <div className={styles.endpointsCard}>
          <h3 className="h4">Webhook Destinations</h3>
          {endpoints.length === 0 ? (
            <div className={styles.emptyState}>
              No webhook endpoints configured in {environment} mode. Click Add Endpoint to get started.
            </div>
          ) : (
            endpoints.map((ep) => (
              <div
                key={ep.publicId}
                className={`${styles.endpointRow} ${
                  selectedEndpoint?.publicId === ep.publicId ? styles.endpointRowActive : ''
                }`}
                onClick={() => setSelectedEndpoint(ep)}
              >
                <div className={styles.endpointHeader}>
                  <span className={styles.urlText}>{ep.url}</span>
                  <Badge variant="default" style={{ fontSize: '0.65rem' }}>
                    {ep.environment}
                  </Badge>
                </div>
                {ep.description && (
                  <p className="body-xs mt-2 text-muted-foreground">{ep.description}</p>
                )}
                <div className={styles.metaInfo}>
                  <span>ID: <code className="monospace">{ep.publicId.substring(0, 15)}…</code></span>
                  <span>Secret: <code className="monospace">••••{ep.secretLastFour}</code></span>
                </div>
                <div className={styles.badgeList}>
                  {ep.subscriptions.map((sub) => (
                    <span key={sub} className={styles.eventBadge}>
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: Endpoint Details, Test Panel, and Delivery History */}
        <div className={styles.detailsPanel}>
          {selectedEndpoint ? (
            <>
              {/* Endpoint Context Card */}
              {/* Telemetry Analytics Card */}
              <div className={styles.detailCard} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className={styles.detailCardTitle}>
                  <span>📊</span> Delivery Telemetry & Analytics
                </div>
                {loadingMetrics ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}>
                    <div className={styles.spinner} style={{ width: 14, height: 14 }}></div>
                    <span className="caption text-muted-foreground">Calculating endpoint performance...</span>
                  </div>
                ) : metrics ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <span className="caption text-muted-foreground block uppercase" style={{ fontSize: '0.65rem' }}>Success Rate</span>
                      <div className="h3 font-bold mt-1" style={{ color: metrics.successRate >= 90 ? '#10b981' : '#f59e0b' }}>
                        {metrics.successRate}%
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <span className="caption text-muted-foreground block uppercase" style={{ fontSize: '0.65rem' }}>Avg Latency</span>
                      <div className="h3 font-bold mt-1 monospace" style={{ color: 'var(--foreground)' }}>
                        {metrics.avgLatency}ms
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <span className="caption text-muted-foreground block uppercase" style={{ fontSize: '0.65rem' }}>Attempts / Failures</span>
                      <div className="h3 font-bold mt-1" style={{ color: metrics.failuresCount > 0 ? '#ef4444' : 'var(--foreground)' }}>
                        {metrics.totalAttempts} / {metrics.failuresCount}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="caption text-muted-foreground" style={{ padding: '8px' }}>
                    No delivery telemetry logged for this endpoint yet.
                  </div>
                )}
              </div>

              {/* Endpoint Context Card */}
              <div className={styles.detailCard}>
                <div className={styles.detailCardTitle}>
                  <span>⚙️</span> Endpoint Details
                </div>
                <div className={styles.formGroup}>
                  <label>URL Destination</label>
                  <code className="monospace" style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', wordBreak: 'break-all' }}>
                    {selectedEndpoint.url}
                  </code>
                </div>
                <div className={styles.formGroup}>
                  <label>Webhook Secret Token</label>
                  <div className={styles.secretBox} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className={styles.secretValue}>
                        whsec_••••••••••••••••••••••••{selectedEndpoint.secretLastFour}
                      </span>
                      <span className="caption text-muted-foreground">(Used for HMAC signature validation)</span>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleRotateSecret(selectedEndpoint.publicId)}
                      disabled={rotating}
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    >
                      {rotating ? 'Rolling...' : '🔄 Rotate'}
                    </Button>
                  </div>
                </div>

                {/* Actions: Test Hook, Simulate, Edit, and Delete */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <Button
                    variant="secondary"
                    onClick={() => handleTestEndpoint(selectedEndpoint.publicId)}
                    disabled={testing}
                    style={{ flex: 1 }}
                  >
                    {testing ? 'Sending Test…' : '⚡ Send Test'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSimResult(null);
                      setShowSimulateModal(true);
                    }}
                    style={{ flex: 1 }}
                  >
                    🛠️ Simulate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditUrl(selectedEndpoint.url);
                      setEditDescription(selectedEndpoint.description || '');
                      setEditEvents(selectedEndpoint.subscriptions || []);
                      setShowEditModal(true);
                    }}
                    style={{ flex: 1 }}
                  >
                    ✏️ Edit Config
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDeleteEndpoint(selectedEndpoint.publicId)}
                    className={styles.dangerBtn}
                    style={{ flex: 0 }}
                  >
                    Delete
                  </Button>
                </div>

                {/* Test payload result overlay */}
                {testResult && (
                  <div
                    className={`${styles.secretReveal} mt-2`}
                    style={{ borderColor: testResult.success ? '#10b981' : '#ef4444' }}
                  >
                    <div
                      className={styles.secretRevealTitle}
                      style={{ color: testResult.success ? '#10b981' : '#ef4444' }}
                    >
                      {testResult.success
                        ? '✔️ Test Delivery Succeeded!'
                        : '❌ Test Delivery Failed'}
                    </div>
                    <ul className="body-xs flex flex-col gap-1 mt-1 text-muted-foreground">
                      <li><strong>Status:</strong> {testResult.delivery.status}</li>
                      <li><strong>Latency:</strong> {testResult.delivery.latency_ms} ms</li>
                      {testResult.delivery.errorMessage && (
                        <li><strong>Error:</strong> {testResult.delivery.errorMessage}</li>
                      )}
                      {testResult.delivery.responseExcerpt && (
                        <li style={{ marginTop: 6 }}>
                          <strong>Response Body excerpt:</strong>
                          <pre className="monospace mt-1" style={{ padding: 6, background: 'var(--surface)', borderRadius: 4, overflowX: 'auto', maxHeight: 80 }}>
                            {testResult.delivery.responseExcerpt}
                          </pre>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Delivery History Logs Card */}
              <div className={styles.detailCard}>
                <div className={styles.detailCardTitle}>
                  <span>📜</span> Webhook Logs (Last 50)
                </div>

                {loadingDeliveries && deliveries.length === 0 ? (
                  <p className="body-xs text-muted-foreground text-center">Loading webhook logs…</p>
                ) : deliveries.length === 0 ? (
                  <div className={styles.emptyState}>
                    No webhook events have been dispatched to this endpoint yet.
                  </div>
                ) : (
                  <div className={styles.logsTableWrapper}>
                    <table className={styles.logsTable}>
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Status</th>
                          <th>Latency</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((d) => {
                          const latestAttempt = d.attempts[0];
                          const statusCode = latestAttempt?.responseStatus;
                          const isOk = statusCode !== null && statusCode >= 200 && statusCode < 300;
                          const isRetrying = retryingIds.includes(d.deliveryId);

                          return (
                            <tr key={d.deliveryId}>
                              <td>
                                <div>
                                  <strong>{d.eventType}</strong>
                                </div>
                                <div className="caption text-muted-foreground" style={{ fontSize: '0.65rem' }}>
                                  {d.eventPublicId.substring(0, 14)}…
                                </div>
                              </td>
                              <td>
                                {statusCode ? (
                                  <span className={isOk ? styles.statusSuccess : styles.statusFailed}>
                                    {statusCode}
                                  </span>
                                ) : (
                                  <span className={styles.statusFailed}>
                                    {latestAttempt?.error ? 'Error' : 'Pending'}
                                  </span>
                                )}
                              </td>
                              <td className="monospace">
                                {latestAttempt?.durationMs !== null ? `${latestAttempt.durationMs}ms` : '—'}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  {latestAttempt?.responseExcerpt || latestAttempt?.error ? (
                                    <button
                                      className={styles.copyBtn}
                                      onClick={() =>
                                        setActiveExcerpt(
                                          latestAttempt.responseExcerpt ||
                                            latestAttempt.error ||
                                            'No details'
                                        )
                                      }
                                      style={{ minWidth: 50 }}
                                    >
                                      View
                                    </button>
                                  ) : null}
                                  <button
                                    className={styles.copyBtn}
                                    onClick={() => handleRetryDelivery(d.deliveryId)}
                                    disabled={isRetrying}
                                    style={{
                                      minWidth: 65,
                                      borderColor: 'rgba(16,185,129,0.3)',
                                      color: 'var(--success-foreground)',
                                      background: isRetrying ? 'transparent' : 'rgba(16,185,129,0.05)',
                                    }}
                                  >
                                    {isRetrying ? 'Retrying…' : 'Retry'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.detailCard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
              <span className="caption text-muted-foreground">Select an endpoint on the left to manage.</span>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>
              {isRotatedSecret ? '🔑 Webhook Secret Rotated' : 'Configure Webhook Destination'}
            </div>

            {!createdSecret ? (
              <form onSubmit={handleCreateEndpoint} style={{ display: 'flex', flex: '1', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {error && (
                  <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4 }}>
                    ⚠️ {error}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label>Endpoint URL</label>
                  <input
                    type="url"
                    placeholder="https://yourdomain.com/webhooks"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    required
                  />
                  <span className="caption text-muted-foreground">
                    Must be a publicly accessible absolute destination URL supporting HTTP POST.
                  </span>
                </div>

                <div className={styles.formGroup}>
                  <label>Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="Fulfillment webhook receiver..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Subscribe to Events</label>
                  <div className={styles.checkboxList}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes('payment.confirmed')}
                        onChange={() => handleEventToggle('payment.confirmed')}
                      />
                      <span><code>payment.confirmed</code> (Triggered when order payment settles)</span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes('payment.claim_created')}
                        onChange={() => handleEventToggle('payment.claim_created')}
                      />
                      <span><code>payment.claim_created</code> (Triggered when customer submits reference)</span>
                    </label>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes('payment.rejected')}
                        onChange={() => handleEventToggle('payment.rejected')}
                      />
                      <span><code>payment.rejected</code> (Triggered when claim manual review fails)</span>
                    </label>
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setError(null);
                    }}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Saving…' : 'Create Endpoint'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div className={styles.secretReveal}>
                  <div className={styles.secretRevealTitle}>🔑 Webhook Endpoint Secret Key</div>
                  <p className="body-xs text-muted-foreground">
                    This secret key is used to sign HTTP payloads and verify they originate from HollowPay.
                  </p>
                  <p className="body-xs text-warning-foreground font-semibold mt-1">
                    ⚠️ Save this secret now. It will not be shown again for security reasons.
                  </p>

                  <div className={styles.secretBox} style={{ marginTop: 8 }}>
                    <code className={styles.secretValue}>{createdSecret}</code>
                    <button
                      className={styles.copyBtn}
                      onClick={() => copyToClipboard(createdSecret)}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <Button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedSecret(null);
                      setError(null);
                      setIsRotatedSecret(false);
                    }}
                  >
                    Close & Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXCERPT DRAWER / DIALOG (when clicking 'View' on log attempt excerpt) */}
      {activeExcerpt && (
        <div className={styles.modalOverlay} onClick={() => setActiveExcerpt(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className={styles.modalTitle}>Transmission Attempt Detail</div>
            <div className={styles.formGroup}>
              <label>Log Message / HTTP Output</label>
              <pre className="monospace" style={{ padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', wordBreak: 'break-all', whiteSpace: 'pre-wrap', maxHeight: 350, overflowY: 'auto', fontSize: '0.75rem' }}>
                {activeExcerpt}
              </pre>
            </div>
            <div className={styles.modalActions}>
              <Button onClick={() => setActiveExcerpt(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATE EVENT MODAL */}
      {showSimulateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: 700 }}>
            <div className={styles.modalTitle}>⚡ Simulate Webhook Event Sandbox</div>
            
            <div className="body-xs text-muted-foreground mb-4">
              Select an event trigger type to mock payload generation, sign with endpoint secret, and execute live dispatch to destination.
            </div>

            <div className={styles.formGroup}>
              <label>Select Event Type</label>
              <select
                value={selectedSimEvent}
                onChange={(e) => setSelectedSimEvent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="claim.created">payment_claim.created (UTR Claim Submitted)</option>
                <option value="claim.confirmed">payment_claim.confirmed (UTR Claim Settled)</option>
                <option value="claim.rejected">payment_claim.rejected (UTR Claim Rejected)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              {/* Payload Preview */}
              <div className={styles.formGroup}>
                <label>Event JSON Payload Preview</label>
                <pre className="monospace" style={{ padding: 12, background: 'var(--surface)', borderRadius: 4, maxHeight: 180, overflowY: 'auto', fontSize: '0.7rem', color: 'var(--foreground-muted)' }}>
                  {JSON.stringify({
                    id: 'evt_hp_sim_xxxxxx',
                    type: selectedSimEvent,
                    createdAt: new Date().toISOString(),
                    data: selectedSimEvent === 'claim.created'
                      ? { claimId: 'clm_hp_sim_9k8L7', orderId: 'ord_hp_sim_123', status: 'pending', amountMinor: 25000 }
                      : selectedSimEvent === 'claim.confirmed'
                      ? { claimId: 'clm_hp_sim_9k8L7', orderId: 'ord_hp_sim_123', status: 'confirmed', amountMinor: 25000 }
                      : { claimId: 'clm_hp_sim_9k8L7', orderId: 'ord_hp_sim_123', status: 'rejected', rejectReason: 'Mismatched payment screenshot' }
                  }, null, 2)}
                </pre>
              </div>

              {/* Execution results */}
              <div className={styles.formGroup}>
                <label>HTTP Response Monitor</label>
                {simulating ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, border: '1px dashed var(--border)', borderRadius: 4 }}>
                    <div className={styles.spinner}></div>
                    <span className="caption text-muted-foreground mt-2">Executing dispatch...</span>
                  </div>
                ) : simResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', padding: 8, background: 'var(--surface)', borderRadius: 4, fontSize: '0.7rem' }}>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span style={{ color: simResult.response.status >= 200 && simResult.response.status < 300 ? '#10b981' : '#ef4444' }}>
                        {simResult.response.status || 'Connection Failed'}
                      </span>
                    </div>
                    <div><strong>Latency:</strong> {simResult.response.durationMs} ms</div>
                    <div>
                      <strong>Response Body Excerpt:</strong>
                      <pre className="monospace mt-1" style={{ padding: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {simResult.response.body || '—'}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, border: '1px dashed var(--border)', borderRadius: 4, color: 'var(--foreground-muted)', fontSize: '0.75rem' }}>
                    No simulation executed yet
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalActions} style={{ marginTop: 24 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSimulateModal(false);
                  setSimResult(null);
                }}
                disabled={simulating}
              >
                Close Sandbox
              </Button>
              <Button onClick={handleSimulateEvent} disabled={simulating}>
                {simulating ? 'Sending...' : '⚡ Trigger Simulation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ENDPOINT MODAL */}
      {showEditModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>✏️ Edit Webhook Endpoint</div>
            
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedEndpoint) return;
                setUpdating(true);
                setError(null);
                try {
                  const res = await fetch(`/api/dashboard/webhooks/${selectedEndpoint.publicId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      url: editUrl.trim(),
                      description: editDescription.trim(),
                      event_types: editEvents
                    })
                  });
                  const json = await res.json();
                  if (!res.ok) {
                    throw new Error(json.error || 'Failed to update webhook endpoint.');
                  }
                  setShowEditModal(false);
                  await fetchEndpoints();
                } catch (err: any) {
                  setError(err.message || 'An error occurred.');
                } finally {
                  setUpdating(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
              {error && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                  {error}
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Webhook URL</label>
                <input
                  type="url"
                  placeholder="https://api.yourdomain.com/webhooks"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Description (Optional)</label>
                <input
                  type="text"
                  placeholder="E.g. Primary production payments receiver"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Events Subscriptions</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  {[
                    { id: 'payment.confirmed', desc: 'Triggered when customer payment is confirmed settled.' },
                    { id: 'payment.claim_created', desc: 'Triggered when customer submits payment claim Reference (UTR).' },
                    { id: 'payment.rejected', desc: 'Triggered when claim manual review fails/rejected.' }
                  ].map((evt) => (
                    <label key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                      <input
                        type="checkbox"
                        checked={editEvents.includes(evt.id)}
                        onChange={() => {
                          setEditEvents((prev) =>
                            prev.includes(evt.id) ? prev.filter((x) => x !== evt.id) : [...prev, evt.id]
                          );
                        }}
                      />
                      <span>
                        <code className="monospace">{evt.id}</code> — {evt.desc}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setError(null);
                  }}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updating}>
                  {updating ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
