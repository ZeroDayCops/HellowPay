'use client';

/**
 * HollowPay — Merchant Payment Pages Settings Console
 *
 * Implements CRUD controls for self-hosted payment pages, custom URL slug definitions,
 * pricing currency allocations, customer telemetry switches, and copyable links.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from './page.module.css';
import { formatCurrency } from '@/lib/utils/currency-formatter';

interface PaymentPage {
  id: number;
  publicId: string;
  slug: string;
  type: string;
  title: string;
  description: string | null;
  amountMinor: number;
  currency: string;
  collectName: boolean;
  collectEmail: boolean;
  collectPhone: boolean;
  status: string;
  createdAt: string;
}

export default function PaymentPagesConsole() {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<PaymentPage[]>([]);
  const [workspaceSlug, setWorkspaceSlug] = useState('merchant');

  // Modal / forms state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<'product' | 'service' | 'quick_payment'>('service');
  const [description, setDescription] = useState('');
  const [amountMajor, setAmountMajor] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [collectName, setCollectName] = useState(true);
  const [collectEmail, setCollectEmail] = useState(true);
  const [collectPhone, setCollectPhone] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch configured pages
  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/payment-pages');
      const json = await res.json();
      if (res.ok) {
        setPages(json.pages || []);
      }
    } catch (err) {
      console.error('Failed to fetch payment pages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch workspace details for slug prefix path preview
  const fetchWorkspaceSlug = useCallback(async () => {
    try {
      // Endpoint api/dashboard/metrics aggregates workspace metadata
      const res = await fetch('/api/dashboard/metrics');
      const json = await res.json();
      if (res.ok && json.workspace) {
        setWorkspaceSlug(json.workspace.slug);
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    fetchPages();
    fetchWorkspaceSlug();
  }, [fetchPages, fetchWorkspaceSlug]);

  // Format currency value (e.g. 50000 -> ₹500.00)
  const formatAmount = (minor: number, currency: string = 'INR') => {
    return formatCurrency(minor, currency);
  };

  // Autogenerate slug from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    const generated = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // remove special chars
      .replace(/\s+/g, '-')          // replace spaces with dashes
      .replace(/-+/g, '-');          // deduplicate dashes
    setSlug(generated);
  };

  // Submit payment page creation
  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || !amountMajor) return;

    const amountMinor = Math.round(parseFloat(amountMajor) * 100);
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setError('Please specify a valid payment amount.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/dashboard/payment-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(),
          type,
          title: title.trim(),
          description: description.trim(),
          amount_minor: amountMinor,
          currency,
          collect_name: collectName,
          collect_email: collectEmail,
          collect_phone: collectPhone,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create payment page.');
      }

      // Reset form
      setTitle('');
      setSlug('');
      setType('service');
      setDescription('');
      setAmountMajor('');
      setCurrency('INR');
      setCollectName(true);
      setCollectEmail(true);
      setCollectPhone(false);
      setShowCreateModal(false);

      await fetchPages();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  // Archive payment page
  const handleArchivePage = async (publicId: string) => {
    if (!confirm('Are you sure you want to archive this payment page? Customers will no longer be able to access this link.')) {
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/payment-pages/${publicId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchPages();
      }
    } catch (err) {
      console.error('Failed to archive payment page:', err);
    }
  };

  // Copy URL link helper
  const copyLink = (slugName: string, id: string) => {
    const fullUrl = `${window.location.origin}/p/${workspaceSlug}/${slugName}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>📄</span> Payment Pages
          </h1>
          <p className="body-sm mt-1 text-muted-foreground">
            Share payment pages via links or button embeds to accept customer payments instantly without writing code.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          ➕ Create Page
        </Button>
      </div>

      {/* Pages Grid layout */}
      {loading && pages.length === 0 ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p className="body-sm text-muted-foreground">Loading payment pages…</p>
        </div>
      ) : pages.length === 0 ? (
        <div className={styles.emptyState}>
          <p className="h4" style={{ marginBottom: 8, color: 'var(--foreground)' }}>No Payment Pages configured</p>
          Create your first hosted payment page to start collecting customer settlements peer-to-peer.
        </div>
      ) : (
        <div className={styles.grid}>
          {pages.map((p) => {
            const publicUrl = `/p/${workspaceSlug}/${p.slug}`;
            return (
              <div key={p.publicId} className={styles.pageCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.pageTitle}>{p.title}</h3>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={styles.badge}>{p.type.replace('_', ' ')}</span>
                      <span className="caption text-muted-foreground" style={{ fontSize: '0.65rem' }}>
                        /{workspaceSlug}/{p.slug}
                      </span>
                    </div>
                  </div>
                </div>

                <p className={styles.pageDesc}>
                  {p.description || 'No description provided.'}
                </p>

                <div className={styles.amountBlock}>
                  <span className={styles.amountLabel}>Price</span>
                  <span className={styles.amountVal}>{formatAmount(p.amountMinor, p.currency)}</span>
                </div>

                <div className={styles.cardActions}>
                  <Link href={publicUrl} target="_blank" className={`${styles.btnLink} ${styles.btnLinkPrimary}`}>
                    👁️ View Page
                  </Link>
                  <button
                    className={styles.btnLink}
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => copyLink(p.slug, p.publicId)}
                  >
                    {copiedId === p.publicId ? '✔️ Copied!' : '🔗 Copy Link'}
                  </button>
                  <button
                    className={styles.archiveBtn}
                    onClick={() => handleArchivePage(p.publicId)}
                    title="Archive Payment Page"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Create Hosted Payment Page</div>

            <form onSubmit={handleCreatePage} style={{ display: 'flex', flex: '1', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {error && (
                <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4 }}>
                  ⚠️ {error}
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Page Title</label>
                <input
                  type="text"
                  placeholder="E.g. Web Pentesting Audit Bundle"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>URL Slug Link</label>
                <div className={styles.slugInputWrapper}>
                  <span className={styles.slugPrefix}>
                    /p/{workspaceSlug}/
                  </span>
                  <input
                    type="text"
                    className={styles.slugInput}
                    placeholder="my-premium-service"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    required
                  />
                </div>
                <span className="caption text-muted-foreground">
                  Alphanumeric and hyphens only.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div className={styles.formGroup}>
                  <label>Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="100.00"
                    value={amountMajor}
                    onChange={(e) => setAmountMajor(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Page Type</label>
                <select value={type} onChange={(e: any) => setType(e.target.value)}>
                  <option value="service">Service Listing</option>
                  <option value="product">Digital Product Page</option>
                  <option value="quick_payment">Quick Payment checkout</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Description</label>
                <textarea
                  placeholder="Explain what is included in this purchase..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Customer Details to Collect</label>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={collectName}
                      disabled
                    />
                    <span>Full Customer Name (Required)</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={collectEmail}
                      disabled
                    />
                    <span>Customer Email Address (Required)</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={collectPhone}
                      onChange={(e) => setCollectPhone(e.target.checked)}
                    />
                    <span>Collect Mobile Phone Number</span>
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
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Page'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
