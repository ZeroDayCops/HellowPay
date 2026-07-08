'use client';

/**
 * HollowPay — Feature Flags Administration Page (Founder-only)
 *
 * Allows platform administrators/founders to create, toggle, and view
 * feature flag configurations globally, per-workspace, or per-project.
 */

import React, { useEffect, useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import styles from './page.module.css';

interface FeatureFlag {
  id: number;
  key: string;
  enabled: boolean;
  scope: 'global' | 'workspace' | 'project';
  scopeId: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminFeatureFlagsPage() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [newKey, setNewKey] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newScope, setNewScope] = useState<'global' | 'workspace' | 'project'>('global');
  const [newScopeId, setNewScopeId] = useState('');
  const [newEnabled, setNewEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch flags
  const fetchFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/feature-flags');
      const data = await res.json();
      if (res.ok) {
        setFlags(data.flags || []);
      } else {
        setError(data.error || 'Failed to retrieve feature flags.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure. Check backend service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  // Handle Toggle
  const handleToggleFlag = async (flag: FeatureFlag) => {
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: flag.key,
          enabled: !flag.enabled,
          scope: flag.scope,
          scopeId: flag.scopeId,
          description: flag.description,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFlags((prev) =>
          prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f))
        );
        setSuccess(`Toggled flag "${flag.key}" successfully.`);
        setTimeout(() => setSuccess(null), 2500);
      } else {
        alert(data.error || 'Failed to toggle flag.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to administrative server.');
    }
  };

  // Submit New Flag
  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.trim(),
          enabled: newEnabled,
          scope: newScope,
          scopeId: newScopeId.trim() || null,
          description: newDescription.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Reset Form
        setNewKey('');
        setNewDescription('');
        setNewScope('global');
        setNewScopeId('');
        setNewEnabled(false);
        setSuccess('Feature flag registered successfully.');
        fetchFlags();
      } else {
        setError(data.error || 'Failed to register feature flag.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className="h2">⚙️ Feature Flags Configuration</h1>
          <p className="body-sm text-muted-foreground mt-1">
            Platform-wide administrative controls to toggle beta features and activation behaviors.
          </p>
        </div>
        <Button onClick={fetchFlags} variant="secondary">
          🔄 Refresh
        </Button>
      </div>

      {error && (
        <div className={styles.alertError}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {success && (
        <div className={styles.alertSuccess}>
          <span>✔️ {success}</span>
        </div>
      )}

      <div className={styles.grid}>
        {/* CREATE FLAG CARD */}
        <Card className={styles.card}>
          <h3 className="body-base font-bold mb-4">Register New Feature Flag</h3>
          <form onSubmit={handleCreateFlag} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Feature Key</label>
              <input
                type="text"
                placeholder="e.g. live_mode_self_service"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Description</label>
              <textarea
                placeholder="Describe what this capability governs..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className={styles.textarea}
                rows={2}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label>Scope</label>
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value as any)}
                  className={styles.select}
                >
                  <option value="global">Global</option>
                  <option value="workspace">Workspace</option>
                  <option value="project">Project</option>
                </select>
              </div>

              {newScope !== 'global' && (
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Scope ID</label>
                  <input
                    type="text"
                    placeholder={newScope === 'project' ? 'proj_...' : 'workspaceSlug'}
                    value={newScopeId}
                    onChange={(e) => setNewScopeId(e.target.value)}
                    className={styles.input}
                    required
                  />
                </div>
              )}
            </div>

            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="newEnabled"
                checked={newEnabled}
                onChange={(e) => setNewEnabled(e.target.checked)}
              />
              <label htmlFor="newEnabled" style={{ userSelect: 'none' }}>
                Enable immediately on register
              </label>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Registering...' : 'Add Feature Flag'}
            </Button>
          </form>
        </Card>

        {/* LIST FLAGS CARD */}
        <Card className={styles.card} style={{ flex: 2 }}>
          <h3 className="body-base font-bold mb-4 font-semibold">Active Configurations</h3>
          {loading ? (
            <div className={styles.loader}>
              <div className={styles.spinner}></div>
              <p className="body-xs mt-2 text-muted-foreground">Retrieving active rules...</p>
            </div>
          ) : flags.length === 0 ? (
            <p className="body-sm text-muted-foreground text-center py-8">
              No feature flags registered. Add one to get started.
            </p>
          ) : (
            <div className={styles.list}>
              {flags.map((f) => (
                <div key={f.id} className={styles.flagRow}>
                  <div className={styles.flagInfo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong className="monospace text-sm">{f.key}</strong>
                      <Badge variant="primary">{f.scope.toUpperCase()}</Badge>
                      {f.scopeId && (
                        <span className="caption font-semibold">
                          ID: <span className="monospace">{f.scopeId}</span>
                        </span>
                      )}
                    </div>
                    {f.description && (
                      <p className="caption text-muted-foreground mt-1">
                        {f.description}
                      </p>
                    )}
                    <span className="caption text-muted-foreground mt-1 block">
                      Updated: {new Date(f.updatedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className={styles.toggleArea}>
                    <span className="caption mr-2 font-semibold">
                      {f.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={() => handleToggleFlag(f)}
                      />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
