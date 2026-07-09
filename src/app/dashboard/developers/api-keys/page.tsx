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
  scopes: string | null;
}

export default function ApiKeysConsole() {
  const { environment } = useEnvironment();

  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);

  // Modal / forms state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [keyType, setKeyType] = useState<'publishable' | 'secret'>('secret');
  const [scopesSelection, setScopesSelection] = useState<string[]>(['read:orders', 'write:orders']);
  
  const [saving, setSaving] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Usage telemetry states
  const [expandedKeyId, setExpandedKeyId] = useState<number | null>(null);
  const [keyUsage, setKeyUsage] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const handleToggleUsage = async (keyId: number, prefix: string) => {
    if (expandedKeyId === keyId) {
      setExpandedKeyId(null);
      setKeyUsage(null);
      return;
    }
    setExpandedKeyId(keyId);
    setLoadingUsage(true);
    try {
      const res = await fetch(`/api/dashboard/api-keys/${prefix}/usage`);
      const json = await res.json();
      if (res.ok) {
        setKeyUsage(json.usage);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsage(false);
    }
  };

  const formatLastActive = (timestampStr: string | null) => {
    if (!timestampStr) return 'Never';
    const date = new Date(timestampStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const renderUsageChart = (data: Array<{ label: string; count: number }>) => {
    const maxVal = Math.max(...data.map(d => d.count), 5);
    const width = 500;
    const height = 120;
    const padding = 20;

    const points = data.map((d, index) => {
      const x = padding + (index * (width - padding * 2)) / (data.length - 1);
      const y = height - padding - (d.count * (height - padding * 2)) / maxVal;
      return { x, y };
    });

    const pathD = points.reduce((acc, p, index) => {
      return acc + `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
    }, '');

    const areaD = pathD + ` L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border)', marginTop: 8 }}>
        <div className="caption text-muted-foreground mb-2" style={{ fontWeight: 'semibold' }}>📊 Daily API Call Activity (Last 7 Days)</div>
        <div style={{ position: 'relative', width: '100%', height: height }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border)" strokeOpacity={0.2} strokeDasharray="3 3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" strokeOpacity={0.4} />
            <path d={areaD} fill="url(#gradient-usage)" opacity={0.1} />
            <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fill="var(--foreground)" fontFamily="var(--font-mono)">
                  {data[i].count}
                </text>
              </g>
            ))}
            <defs>
              <linearGradient id="gradient-usage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: padding, paddingRight: padding, marginTop: 4 }}>
          {data.map((d, i) => (
            <span key={i} className="caption text-muted-foreground" style={{ fontSize: '0.65rem' }}>{d.label}</span>
          ))}
        </div>
      </div>
    );
  };

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
          scopes: scopesSelection,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setRevealedSecret(json.raw_key);
        setName('');
        setScopesSelection(['read:orders', 'write:orders']);
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

  // Helper to render scopes
  const renderScopes = (scopesStr: string | null) => {
    try {
      const arr: string[] = JSON.parse(scopesStr || '["*"]');
      return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {arr.map((s) => (
            <Badge key={s} variant="default" style={{ fontSize: '0.65rem', textTransform: 'none' }}>
              {s}
            </Badge>
          ))}
        </div>
      );
    } catch {
      return <span className="caption text-muted-foreground">—</span>;
    }
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
                    <th>Scopes</th>
                    <th>Last Active</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {secretKeys.map((k) => (
                    <React.Fragment key={k.id}>
                      <tr>
                        <td className="body-sm" style={{ fontWeight: '600' }}>{k.name}</td>
                        <td>
                          <code className="monospace">{k.prefix}_***_{k.lastFour}</code>
                        </td>
                        <td>
                          {renderScopes(k.scopes)}
                        </td>
                        <td className="caption text-muted-foreground monospace">
                          {formatLastActive(k.lastUsedAt)}
                        </td>
                        <td className="caption text-muted-foreground">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                              variant="secondary"
                              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                              onClick={() => handleToggleUsage(k.id, k.prefix)}
                            >
                              {expandedKeyId === k.id ? 'Hide Stats' : '📊 Stats'}
                            </Button>
                            <button className={styles.btnRevoke} onClick={() => handleRevokeKey(k.id)}>
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedKeyId === k.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0px 16px 16px 16px', background: 'rgba(0,0,0,0.05)' }}>
                            {loadingUsage ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px' }}>
                                <div className={styles.spinner} style={{ width: 14, height: 14, margin: 0 }}></div>
                                <span className="caption text-muted-foreground">Loading key usage stats...</span>
                              </div>
                            ) : keyUsage ? (
                              renderUsageChart(keyUsage)
                            ) : (
                              <span className="caption text-muted-foreground">No usage details found.</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
                    <th>Scopes</th>
                    <th>Last Active</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {publishableKeys.map((k) => (
                    <React.Fragment key={k.id}>
                      <tr>
                        <td className="body-sm" style={{ fontWeight: '600' }}>{k.name}</td>
                        <td>
                          <code className="monospace">{k.prefix}_***_{k.lastFour}</code>
                        </td>
                        <td>
                          {renderScopes(k.scopes)}
                        </td>
                        <td className="caption text-muted-foreground monospace">
                          {formatLastActive(k.lastUsedAt)}
                        </td>
                        <td className="caption text-muted-foreground">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                              variant="secondary"
                              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                              onClick={() => handleToggleUsage(k.id, k.prefix)}
                            >
                              {expandedKeyId === k.id ? 'Hide Stats' : '📊 Stats'}
                            </Button>
                            <button className={styles.btnRevoke} onClick={() => handleRevokeKey(k.id)}>
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedKeyId === k.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0px 16px 16px 16px', background: 'rgba(0,0,0,0.05)' }}>
                            {loadingUsage ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px' }}>
                                <div className={styles.spinner} style={{ width: 14, height: 14, margin: 0 }}></div>
                                <span className="caption text-muted-foreground">Loading key usage stats...</span>
                              </div>
                            ) : keyUsage ? (
                              renderUsageChart(keyUsage)
                            ) : (
                              <span className="caption text-muted-foreground">No usage details found.</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

                <div className={styles.formGroup}>
                  <label>Select API Permission Scopes</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    {[
                      { id: 'read:orders', desc: 'Read orders list and details' },
                      { id: 'write:orders', desc: 'Create and cancel orders' },
                      { id: 'read:claims', desc: 'Fetch customer payment claims list' },
                      { id: 'write:claims', desc: 'Resolve or reject payment claims' },
                      { id: 'read:webhooks', desc: 'Inspect webhook delivery log history' },
                      { id: 'write:webhooks', desc: 'Configure or test webhook endpoints' }
                    ].map((s) => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                        <input
                          type="checkbox"
                          checked={scopesSelection.includes(s.id)}
                          onChange={() => {
                            setScopesSelection((prev) =>
                              prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                            );
                          }}
                        />
                        <span>
                          <code className="monospace">{s.id}</code> — {s.desc}
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
