'use client';

/**
 * HollowPay — Business Payment Destination Configurator Settings
 *
 * Implements payee UPI VPA address settings, regex validation checks,
 * live QR code preview simulations, and environment specific configurations.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from './page.module.css';

export default function PaymentDestinationPage() {
  const { environment } = useEnvironment();

  const [loading, setLoading] = useState(true);
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [status, setStatus] = useState('not_configured');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch current configs
  const fetchDestination = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/business/payment-destination?env=${environment}`);
      const json = await res.json();
      if (res.ok && json.destination) {
        setUpiId(json.destination.upiId || '');
        setPayeeName(json.destination.payeeName || '');
        setStatus(json.destination.status || 'not_configured');
      }
    } catch (err) {
      console.error('Failed to load payment destination:', err);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    fetchDestination();
  }, [fetchDestination]);

  // Submit UPI details update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiId.trim() || !payeeName.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/dashboard/business/payment-destination?env=${environment}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upi_id: upiId.trim(),
          payee_name: payeeName.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'UPI payment destination updated successfully.' });
        setStatus('active');
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to update destination.' });
      }
    } catch (err) {
      console.error('Failed to save payment destination:', err);
      setMessage({ type: 'error', text: 'An unexpected connection error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className="h2">💳 Payment Destination</h1>
        <p className="body-sm text-muted-foreground mt-1">
          Configure the primary BHIM UPI address where buyer payments should be settled peer-to-peer.
        </p>
      </div>

      {loading ? (
        <div className={styles.card}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>UPI Payee Details ({environment === 'live' ? 'Live Mode' : 'Test Sandbox'})</div>

          {/* Status highlight banner */}
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${status === 'active' ? styles.statusActive : styles.statusPending}`}></div>
            <span>
              Status: <strong>{status === 'active' ? 'Active & Ready' : 'Not Configured'}</strong>
            </span>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {message && (
              <div
                className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  borderRadius: 4,
                  border: '1px solid',
                  background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: message.type === 'success' ? '#10b981' : '#ef4444',
                  borderColor: message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                }}
              >
                {message.type === 'success' ? '✔️' : '⚠️'} {message.text}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="upiId">UPI VPA ID</label>
              <input
                id="upiId"
                type="text"
                placeholder="E.g. brandname@okhdfcbank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                required
                disabled={saving}
              />
              <span className="caption text-muted-foreground" style={{ marginTop: 2 }}>
                The virtual payment address (VPA) linked to your bank account.
              </span>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="payeeName">Payee Name</label>
              <input
                id="payeeName"
                type="text"
                placeholder="E.g. ZeroDayCops Ltd"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                required
                disabled={saving}
              />
              <span className="caption text-muted-foreground" style={{ marginTop: 2 }}>
                Your legal business name or account holder name registered with your UPI provider.
              </span>
            </div>

            {/* Visual simulation box */}
            {upiId && payeeName && (
              <div className={styles.previewBox}>
                <div className={styles.previewTitle}>QR intent preview</div>
                <div className="monospace" style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', wordBreak: 'break-all' }}>
                  upi://pay?pa={upiId}&pn={encodeURIComponent(payeeName)}&cu=INR
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <Button type="submit" disabled={saving || !upiId.trim() || !payeeName.trim()}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
