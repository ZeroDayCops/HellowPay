'use client';

/**
 * HollowPay — Admin Dashboard (Superadmin Overview)
 *
 * Full platform command center: real-time user data, payment data,
 * order pipeline, workspace metrics, and system health.
 * Access restricted to superadmin accounts (karanvaniya364@gmail.com, zerodaycops@gmail.com).
 */

import React, { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';

type TabKey = 'overview' | 'users' | 'orders' | 'payments' | 'workspaces';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (tab: TabKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/data?tab=${tab}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
  };

  const formatAmount = (minorUnits: number | string | null, currency = 'INR') => {
    if (minorUnits == null) return '₹0.00';
    const val = Number(minorUnits) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: styles.badgeSuccess,
      active: styles.badgeInfo,
      created: styles.badgeNeutral,
      expired: styles.badgeWarning,
      cancelled: styles.badgeDanger,
      confirmed: styles.badgeSuccess,
      pending: styles.badgeWarning,
      rejected: styles.badgeDanger,
      failed: styles.badgeDanger,
      settled: styles.badgeSuccess,
    };
    return (
      <span className={`${styles.badge} ${map[status] || styles.badgeNeutral}`}>
        {status}
      </span>
    );
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '⬡' },
    { key: 'users', label: 'All Users', icon: '👤' },
    { key: 'orders', label: 'All Orders', icon: '📦' },
    { key: 'payments', label: 'All Payments', icon: '💰' },
    { key: 'workspaces', label: 'Workspaces', icon: '🏢' },
  ];

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h1 className="h2">System Administration</h1>
        <p className="body-sm mt-1">
          HollowPay full platform data: Users, Payments, Orders, Workspaces — all in one place.
        </p>
      </div>

      {/* Tab Bar */}
      <div className={styles.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => handleTabChange(t.key)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => fetchData(activeTab)}
          disabled={loading}
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className={styles.errorBanner}>
          ⚠️ {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p className="body-sm">Loading platform data…</p>
        </div>
      )}

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === 'overview' && data?.overview && (
        <>
          <div className={styles.metricsGrid}>
            <div className="card">
              <div className="caption">Total Users</div>
              <div className={styles.metricValue}>{data.overview.totalUsers}</div>
              <div className="caption mt-2">Registered accounts</div>
            </div>
            <div className="card">
              <div className="caption">Total Orders</div>
              <div className={styles.metricValue}>{data.overview.totalOrders}</div>
              <div className="caption mt-2">All time</div>
            </div>
            <div className="card">
              <div className="caption">Total Workspaces</div>
              <div className={styles.metricValue}>{data.overview.totalWorkspaces}</div>
              <div className="caption mt-2">Active organizations</div>
            </div>
            <div className="card">
              <div className="caption">Total Projects</div>
              <div className={styles.metricValue}>{data.overview.totalProjects}</div>
              <div className="caption mt-2">Merchant projects</div>
            </div>
            <div className="card">
              <div className="caption">Total Customers</div>
              <div className={styles.metricValue}>{data.overview.totalCustomers}</div>
              <div className="caption mt-2">End customers</div>
            </div>
            <div className="card">
              <div className="caption">Paid Orders</div>
              <div className={styles.metricValue} style={{ color: 'var(--success-foreground)' }}>
                {data.overview.volume?.paidCount ?? 0}
              </div>
              <div className="caption mt-2">Confirmed payments</div>
            </div>
            <div className="card">
              <div className="caption">Active Orders</div>
              <div className={styles.metricValue} style={{ color: 'var(--warning-foreground, #f59e0b)' }}>
                {data.overview.volume?.activeCount ?? 0}
              </div>
              <div className="caption mt-2">In progress</div>
            </div>
            <div className="card">
              <div className="caption">Total Payment Volume</div>
              <div className={styles.metricValue}>
                {formatAmount(data.overview.volume?.totalMinor)}
              </div>
              <div className="caption mt-2">Across all orders</div>
            </div>
          </div>

          {/* Recent Orders Section */}
          <div className={styles.adminSection}>
            <h3 className="h4">Recent Orders</h3>
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Env</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.overview.recentOrders?.map((o: any) => (
                    <tr key={o.publicId}>
                      <td className={styles.mono}>{o.publicId}</td>
                      <td>{formatAmount(o.amountMinor, o.currency)}</td>
                      <td>{statusBadge(o.status)}</td>
                      <td>
                        <span className={`${styles.envTag} ${o.environment === 'live' ? styles.envLive : styles.envTest}`}>
                          {o.environment}
                        </span>
                      </td>
                      <td>{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Users Section */}
          <div className={styles.adminSection}>
            <h3 className="h4">Recent Users</h3>
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Admin</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.overview.recentUsers?.map((u: any) => (
                    <tr key={u.publicId}>
                      <td>{u.email}</td>
                      <td>{u.name || '—'}</td>
                      <td>{u.isAdmin ? '✅' : '—'}</td>
                      <td>{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========== USERS TAB ========== */}
      {activeTab === 'users' && data?.users && (
        <div className={styles.adminSection}>
          <h3 className="h4">All Registered Users ({data.users.length})</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Public ID</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Admin</th>
                  <th>Clerk ID</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u: any, i: number) => (
                  <tr key={u.publicId}>
                    <td>{i + 1}</td>
                    <td className={styles.mono}>{u.publicId}</td>
                    <td>{u.email}</td>
                    <td>{u.name || '—'}</td>
                    <td>{u.isAdmin ? '✅ Admin' : '—'}</td>
                    <td className={styles.mono} style={{ fontSize: '0.7rem' }}>{u.clerkUserId}</td>
                    <td>{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== ORDERS TAB ========== */}
      {activeTab === 'orders' && data?.orders && (
        <div className={styles.adminSection}>
          <h3 className="h4">All Orders ({data.orders.length})</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Env</th>
                  <th>Project</th>
                  <th>Merchant Ref</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o: any, i: number) => (
                  <tr key={o.publicId}>
                    <td>{i + 1}</td>
                    <td className={styles.mono}>{o.publicId}</td>
                    <td>{formatAmount(o.amountMinor, o.currency)}</td>
                    <td>{statusBadge(o.status)}</td>
                    <td>
                      <span className={`${styles.envTag} ${o.environment === 'live' ? styles.envLive : styles.envTest}`}>
                        {o.environment}
                      </span>
                    </td>
                    <td>{o.projectName || '—'}</td>
                    <td className={styles.mono}>{o.merchantOrderId || '—'}</td>
                    <td>{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== PAYMENTS TAB ========== */}
      {activeTab === 'payments' && data && (
        <div className={styles.adminSection}>
          <h3 className="h4">Payment Claims ({data.claims?.length ?? 0})</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Claim ID</th>
                  <th>Status</th>
                  <th>UTR</th>
                  <th>Order</th>
                  <th>Amount</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {data.claims?.map((c: any, i: number) => (
                  <tr key={c.publicId}>
                    <td>{i + 1}</td>
                    <td className={styles.mono}>{c.publicId}</td>
                    <td>{statusBadge(c.status)}</td>
                    <td className={styles.mono}>{c.utrNumber || '—'}</td>
                    <td className={styles.mono}>{c.orderPublicId || '—'}</td>
                    <td>{formatAmount(c.orderAmount, c.orderCurrency)}</td>
                    <td>{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
                {(!data.claims || data.claims.length === 0) && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No payment claims yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data.transactions && data.transactions.length > 0 && (
            <>
              <h3 className="h4" style={{ marginTop: 'var(--space-6)' }}>Transactions ({data.transactions.length})</h3>
              <div className={styles.tableWrapper}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Txn ID</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t: any, i: number) => (
                      <tr key={t.publicId}>
                        <td>{i + 1}</td>
                        <td className={styles.mono}>{t.publicId}</td>
                        <td>{formatAmount(t.amountMinor, t.currency)}</td>
                        <td>{statusBadge(t.status)}</td>
                        <td>{formatDate(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== WORKSPACES TAB ========== */}
      {activeTab === 'workspaces' && data?.workspaces && (
        <div className={styles.adminSection}>
          <h3 className="h4">All Workspaces ({data.workspaces.length})</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Public ID</th>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.workspaces.map((w: any, i: number) => (
                  <tr key={w.publicId}>
                    <td>{i + 1}</td>
                    <td className={styles.mono}>{w.publicId}</td>
                    <td>{w.name}</td>
                    <td className={styles.mono}>{w.slug}</td>
                    <td>{formatDate(w.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
