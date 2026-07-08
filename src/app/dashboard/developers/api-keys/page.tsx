'use client';

/**
 * HollowPay — Developer API Keys Configurations Settings
 *
 * Implements CRUD actions for named key pairs, security warning notices,
 * copy secret tokens once alerts, and immediate token revocation controls.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from './page.module.css';

interface ApiKey {
  id: number;
  name: string;
  keyType: string;
  prefix: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function ApiKeysConsole() {
  const { environment } = useEnvironment();

  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);

  // Modal / forms state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [keyType, setKeyType] = useState<'publishable' | 'secret'>('secret');
  
  const [saving, setSaving] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch API keys
  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/api-keys?env=${environment}`);
      const json = await res.json();
      if (res.ok) {
        setKeys(json.keys || []);
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Create new key handler
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setRevealedSecret(null);

    try {
      const res = await fetch('/api/dashboard/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          key_type: keyType,
          environment,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setRevealedSecret(json.raw_key);
        setName('');
        // Refresh keys list
        await fetchKeys();
      } else {
        alert(json.error || 'Failed to generate key.');
      }
    } catch (err) {
      console.error('Failed to create key:', err);
    } finally {
      setSaving(false);
    }
  };

  // Revoke active key handler
  const handleRevokeKey = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this API key? Any applications currently using this key will immediately return 401 errors.')) {
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/api-keys/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchKeys();
      }
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    }
  };

  // Copy secret key helper
  const copyToClipboard = () => {
    if (!revealedSecret) return;
    navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Separate keys by type
  const secretKeys = keys.filter((k) => k.keyType === 'secret');
  const publishableKeys = keys.filter((k) => k.keyType === 'publishable');

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>🔑</span> API Keys
          </h1>
          <p className="body-sm mt-1 text-muted-foreground">
            Generate and manage access tokens to query the HollowPay API from your servers or client integrations.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          ➕ Generate Key
        </Button>
      </div>

      <div className={styles.grid}>
        {/* Secret Keys List Card */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>🔒 Secret Keys</div>
          <p className="body-xs text-muted-foreground" style={{ marginTop: -8 }}>
            Use these keys to perform write transactions (create orders, claims simulations) from your backend. Never expose these in client apps.
          </p>

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
            </div>
          ) : secretKeys.length === 0 ? (
            <div className={styles.emptyState}>No secret keys generated in {environment} environment.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Token Prefix</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {secretKeys.map((k) => (
                    <tr key={k.id}>
                      <td className="body-sm" style={{ fontWeight: '600' }}>{k.name}</td>
                      <td>
                        <code className="monospace">{k.prefix}_***_{k.lastFour}</code>
                      </td>
                      <td className="caption text-muted-foreground">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <button className={styles.btnRevoke} onClick={() => handleRevokeKey(k.id)}>
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Publishable Keys List Card */}
        <div className={styles.card}>
          <div className={styles.sectionTitle}>🌐 Publishable Keys</div>
          <p className="body-xs text-muted-foreground" style={{ marginTop: -8 }}>
            Use these keys to authenticate clients or retrieve non-sensitive details in frontend elements.
          </p>

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
            </div>
          ) : publishableKeys.length === 0 ? (
            <div className={styles.emptyState}>No publishable keys generated in {environment} environment.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Token Prefix</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {publishableKeys.map((k) => (
                    <tr key={k.id}>
                      <td className="body-sm" style={{ fontWeight: '600' }}>{k.name}</td>
                      <td>
                        <code className="monospace">{k.prefix}_***_{k.lastFour}</code>
                      </td>
                      <td className="caption text-muted-foreground">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <button className={styles.btnRevoke} onClick={() => handleRevokeKey(k.id)}>
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* GENERATE KEY MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Generate New API Key</div>

            {revealedSecret ? (
              // Display secret once
              <div className={styles.secretRevealBox}>
                <div className={styles.secretTitle}>Copy Your Secret API Key</div>
                <p className="body-xs text-muted-foreground">
                  Please copy this key and store it securely. For security reasons, <strong>we will not show it again</strong>.
                </p>

                <div className={styles.secretValueWrapper}>
                  <div className={styles.secretText}>{revealedSecret}</div>
                  <button className={styles.copyBtn} onClick={copyToClipboard}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div className={styles.warningBanner}>
                  ⚠️ If you navigate away or close this modal, you will not be able to retrieve this key again.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <Button onClick={() => {
                    setShowCreateModal(false);
                    setRevealedSecret(null);
                  }}>
                    I have saved the key
                  </Button>
                </div>
              </div>
            ) : (
              // Create form
              <form onSubmit={handleCreateKey} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div className={styles.formGroup}>
                  <label>Key Name</label>
                  <input
                    type="text"
                    placeholder="E.g. Production Backend"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Key Type</label>
                  <select value={keyType} onChange={(e: any) => setKeyType(e.target.value)}>
                    <option value="secret">Secret Key (sk_...)</option>
                    <option value="publishable">Publishable Key (pk_...)</option>
                  </select>
                </div>

                <div className={styles.modalActions}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setName('');
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Generating…' : 'Generate'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
