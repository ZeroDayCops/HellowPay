'use client';

/**
 * HollowPay — Admin Merchants Overview
 *
 * Lists all registered merchants (workspaces + businesses) with their projects.
 */

import React, { useState, useEffect } from 'react';
import styles from '../page.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminMerchantsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/data?tab=workspaces')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Access denied');
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  if (loading) {
    return (
      <div className={styles.overview}>
        <div className={styles.pageHeader}>
          <h1 className="h2">Merchants</h1>
          <p className="body-sm mt-1">All registered merchant workspaces.</p>
        </div>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p className="body-sm">Loading merchants…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.overview}>
        <div className={styles.pageHeader}>
          <h1 className="h2">Merchants</h1>
        </div>
        <div className={styles.errorBanner}>⚠️ {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h1 className="h2">Merchants</h1>
        <p className="body-sm mt-1">All registered merchant workspaces across the platform.</p>
      </div>

      <div className={styles.adminSection}>
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
              {data?.workspaces?.map((w: any, i: number) => (
                <tr key={w.publicId}>
                  <td>{i + 1}</td>
                  <td className={styles.mono}>{w.publicId}</td>
                  <td>{w.name}</td>
                  <td className={styles.mono}>{w.slug}</td>
                  <td>{formatDate(w.createdAt)}</td>
                </tr>
              ))}
              {(!data?.workspaces || data.workspaces.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                    No merchant workspaces registered yet.
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
