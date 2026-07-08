'use client';

/**
 * HollowPay — General Project Settings & Environments Switcher
 *
 * Implements project name modifications, active live mode request flows,
 * test environment toggles, and metadata specifications.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from '../business/profile/page.module.css';

export default function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [testMode, setTestMode] = useState(true);
  const [liveMode, setLiveMode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [requestingLive, setRequestingLive] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live Mode Application State
  const [appStatus, setAppStatus] = useState<string>('not_requested');
  const [appReason, setAppReason] = useState<string | null>(null);

  // Fetch project settings and live mode applications
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/settings');
      const json = await res.json();
      if (res.ok && json.project) {
        setName(json.project.name || '');
        setTestMode(json.project.testModeEnabled);
        setLiveMode(json.project.liveModeEnabled);
      }

      const appRes = await fetch('/api/dashboard/settings/live-application');
      const appJson = await appRes.json();
      if (appRes.ok && appJson.application) {
        setAppStatus(appJson.application.status);
        setAppReason(appJson.application.reviewReason);
      }
    } catch (err) {
      console.error('Failed to load project settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Request Live Mode Activation
  const handleRequestLiveMode = async () => {
    setRequestingLive(true);
    setMessage(null);
    try {
      const res = await fetch('/api/dashboard/settings/live-application', {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok) {
        setAppStatus('pending_review');
        setMessage({ type: 'success', text: 'Live Mode compliance request submitted successfully.' });
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to submit Live Mode request.' });
      }
    } catch (err) {
      console.error('Failed to request live mode:', err);
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setRequestingLive(false);
    }
  };

  // Submit settings update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          test_mode: testMode,
          live_mode: liveMode,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Project configurations saved successfully.' });
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to save project settings.' });
      }
    } catch (err) {
      console.error('Failed to save project settings:', err);
      setMessage({ type: 'error', text: 'An unexpected connection error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className="h2">⚙️ Settings</h1>
        <p className="body-sm text-muted-foreground mt-1">
          Manage project workspace parameters, environment flags, and display attributes.
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
          <div className={styles.sectionTitle}>Project Settings</div>

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

            {/* Display Name */}
            <div className={styles.formGroup}>
              <label htmlFor="projectName">Project Name</label>
              <input
                id="projectName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            {/* Environment active flags */}
            <div className={styles.formGroup} style={{ gap: 12 }}>
              <label>Environment Modes</label>

              {/* Test Mode */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <input
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  disabled={saving}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <div>
                  <div className="body-sm" style={{ fontWeight: '600' }}>Enable Test Mode (Sandbox)</div>
                  <div className="caption text-muted-foreground">Allows creating simulated checkout sessions and making peer-to-peer verification claims.</div>
                </div>
              </div>

              {/* Live Mode */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', opacity: appStatus === 'approved' ? 1 : 0.75 }}>
                <input
                  type="checkbox"
                  checked={liveMode && appStatus === 'approved'}
                  onChange={(e) => setLiveMode(e.target.checked)}
                  disabled={saving || appStatus !== 'approved'}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: appStatus === 'approved' ? 'pointer' : 'not-allowed' }}
                />
                <div>
                  <div className="body-sm" style={{ fontWeight: '600' }}>Enable Live Mode (Production)</div>
                  <div className="caption text-muted-foreground">Enables live merchant claims and processes real UPI transfers. Requires founder compliance verification.</div>
                </div>
              </div>

              {/* Live Mode Verification Status Box */}
              <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="body-sm font-semibold">Live Mode Status:</div>
                    <div className="caption text-muted-foreground mt-1">
                      {appStatus === 'not_requested' && 'Your project is in sandbox/testing mode. To process live payments, you must apply for Live Mode.'}
                      {appStatus === 'pending_review' && 'Compliance application submitted. Our administrators are auditing your UPI payee configuration.'}
                      {appStatus === 'approved' && 'Congratulations! Your business details are verified. You can now toggle Live Mode.'}
                      {appStatus === 'rejected' && `Application rejected. Reason: "${appReason || 'Incomplete compliance verification documentation.'}"`}
                      {appStatus === 'suspended' && 'Live Mode access suspended. Please contact supervisor support for details.'}
                    </div>
                  </div>
                  <div style={{ marginLeft: 16 }}>
                    {appStatus === 'not_requested' && (
                      <Button type="button" onClick={handleRequestLiveMode} disabled={requestingLive}>
                        {requestingLive ? 'Applying...' : 'Request Activation'}
                      </Button>
                    )}
                    {appStatus === 'pending_review' && (
                      <Badge variant="warning">AWAITING REVIEW</Badge>
                    )}
                    {appStatus === 'approved' && (
                      <Badge variant="success">APPROVED</Badge>
                    )}
                    {appStatus === 'rejected' && (
                      <Button type="button" onClick={handleRequestLiveMode} disabled={requestingLive}>
                        {requestingLive ? 'Re-applying...' : 'Re-apply'}
                      </Button>
                    )}
                    {appStatus === 'suspended' && (
                      <Badge variant="danger">SUSPENDED</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
