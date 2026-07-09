'use client';

/**
 * HollowPay — Admin Audit Trail
 *
 * Displays system-wide audit logs for admin visibility.
 */

import React, { useState, useEffect } from 'react';
import styles from '../page.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/audit-logs')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Access denied');
        return res.json();
      })
      .then((json) => setLogs(json.logs || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return iso; }
  };

  if (loading) {
    return (
      <div className={styles.overview}>
        <div className={styles.pageHeader}>
          <h1 className="h2">Audit Trail</h1>
          <p className="body-sm mt-1">System-wide audit log of all administrative and merchant actions.</p>
        </div>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p className="body-sm">Loading audit logs…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.overview}>
        <div className={styles.pageHeader}>
          <h1 className="h2">Audit Trail</h1>
        </div>
        <div className={styles.errorBanner}>⚠️ {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h1 className="h2">Audit Trail</h1>
        <p className="body-sm mt-1">Complete immutable log of all platform actions across merchants and administrators.</p>
      </div>

      <div className={styles.adminSection}>
        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Log ID</th>
                <th>Action</th>
                <th>Target Type</th>
                <th>Target ID</th>
                <th>Actor</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any, i: number) => (
                <tr key={log.publicId || i}>
                  <td>{i + 1}</td>
                  <td className={styles.mono}>{log.publicId}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeInfo}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.targetType || '—'}</td>
                  <td className={styles.mono}>{log.targetId || '—'}</td>
                  <td>{log.actorEmail || log.actorId || '—'}</td>
                  <td>{formatDate(log.createdAt)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    📝 No audit events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
