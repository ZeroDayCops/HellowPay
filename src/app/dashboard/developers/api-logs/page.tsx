'use client';

/**
 * HollowPay — Developer API Request Logs Page
 *
 * Implements transaction request tracing, status highlights, latency metrics, and payload explorer modals.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from './page.module.css';

interface ApiRequestLog {
  id: number;
  publicId: string;
  method: string;
  path: string;
  statusCode: number | null;
  apiKeyPrefix: string | null;
  durationMs: number | null;
  requestHeaders: any;
  requestBody: any;
  responseBody: any;
  ipAddress: string | null;
  requestId: string | null;
  createdAt: string;
}

export default function ApiLogsDashboardPage() {
  const { environment } = useEnvironment();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ApiRequestLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ApiRequestLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch API Request logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/api-logs?env=${environment}&limit=100`);
      const json = await res.json();
      if (res.ok) {
        setLogs(json.logs || []);
      }
    } catch (err) {
      console.error('Failed to load API request logs:', err);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Format method badge helper
  const getMethodBadgeClass = (method: string) => {
    const m = method.toUpperCase();
    if (m === 'GET') return styles.methodGet;
    if (m === 'POST') return styles.methodPost;
    if (m === 'DELETE') return styles.methodDelete;
    return styles.methodPut;
  };

  // Format status code text helper
  const getStatusClass = (code: number | null) => {
    if (!code) return styles.statusWarning;
    if (code >= 200 && code < 300) return styles.statusSuccess;
    if (code >= 400 && code < 500) return styles.statusWarning;
    return styles.statusError;
  };

  // Filter logs locally based on search query
  const filteredLogs = logs.filter((log) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      log.path.toLowerCase().includes(query) ||
      log.publicId.toLowerCase().includes(query) ||
      (log.requestId && log.requestId.toLowerCase().includes(query)) ||
      (log.statusCode && String(log.statusCode).includes(query))
    );
  });

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>📝</span> API Request Logs
          </h1>
          <p className="body-sm mt-1 text-muted-foreground">
            Observe incoming REST API transaction payloads, status results, and sanitization reports.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchLogs}>
          🔄 Refresh
        </Button>
      </div>

      {/* Main Table Panel */}
      <div className={styles.tableCard}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <Input
              placeholder="Search by path, request ID, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading && logs.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p className="body-sm text-muted-foreground mt-2">Loading API request logs…</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            No API transaction logs found {searchQuery ? 'matching your query' : `in ${environment} mode`}.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Request ID</th>
                  <th>Time</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const date = new Date(log.createdAt);
                  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <tr key={log.id}>
                      <td>
                        <span className={`${styles.methodBadge} ${getMethodBadgeClass(log.method)}`}>
                          {log.method}
                        </span>
                      </td>
                      <td>
                        <code className="monospace">{log.path}</code>
                      </td>
                      <td>
                        <span className={getStatusClass(log.statusCode)}>
                          {log.statusCode || '—'}
                        </span>
                      </td>
                      <td className="monospace">
                        {log.durationMs !== null ? `${log.durationMs}ms` : '—'}
                      </td>
                      <td>
                        <code className="monospace" style={{ fontSize: '0.75rem' }}>
                          {log.requestId ? `${log.requestId.substring(0, 12)}…` : '—'}
                        </code>
                      </td>
                      <td className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                        {formattedTime}
                      </td>
                      <td>
                        <button
                          className={styles.spinner}
                          style={{
                            width: 'auto',
                            height: 'auto',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '2px 8px',
                            animation: 'none',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            color: 'var(--foreground-muted)',
                            background: 'var(--card)',
                          }}
                          onClick={() => setSelectedLog(log)}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INSPECT LOG DETAILS MODAL */}
      {selectedLog && (
        <div className={styles.modalOverlay} onClick={() => setSelectedLog(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Request Inspector</div>
              <button
                className={styles.spinner}
                style={{
                  width: 'auto',
                  height: 'auto',
                  border: 'none',
                  background: 'none',
                  animation: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  color: 'var(--foreground-muted)',
                }}
                onClick={() => setSelectedLog(null)}
              >
                ✕
              </button>
            </div>

            {/* Meta statistics */}
            <div className={styles.grid2Col} style={{ background: 'rgba(74, 21, 75, 0.03)', border: '1px solid var(--border)', padding: 16, borderRadius: 'var(--radius-md)' }}>
              <div className={styles.formGroup}>
                <label>Request Path</label>
                <div className="monospace body-xs">
                  <span className={`${styles.methodBadge} ${getMethodBadgeClass(selectedLog.method)}`} style={{ marginRight: 8 }}>
                    {selectedLog.method}
                  </span>
                  {selectedLog.path}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>HTTP Response</label>
                <div className="monospace body-xs">
                  <span className={getStatusClass(selectedLog.statusCode)} style={{ marginRight: 8 }}>
                    {selectedLog.statusCode || '—'}
                  </span>
                  ({selectedLog.durationMs !== null ? `${selectedLog.durationMs}ms` : '—'} latency)
                </div>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Request ID</label>
                <code className="monospace body-xs">{selectedLog.requestId || '—'}</code>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Client IP Address</label>
                <code className="monospace body-xs">{selectedLog.ipAddress || '—'}</code>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>API Key Prefix</label>
                <code className="monospace body-xs">{selectedLog.apiKeyPrefix ? `${selectedLog.apiKeyPrefix}_***` : 'Anonymous / Cookie Auth'}</code>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Logged At</label>
                <span className="body-xs text-muted-foreground">{new Date(selectedLog.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Sanitized request headers */}
            {selectedLog.requestHeaders && (
              <div className={styles.formGroup}>
                <label>Request Headers (Sanitized)</label>
                <pre className={styles.payloadBox}>
                  {JSON.stringify(selectedLog.requestHeaders, null, 2)}
                </pre>
              </div>
            )}

            {/* Sanitized request payload */}
            {selectedLog.requestBody && (
              <div className={styles.formGroup}>
                <label>Request Body Payload (Sanitized)</label>
                <pre className={styles.payloadBox}>
                  {JSON.stringify(selectedLog.requestBody, null, 2)}
                </pre>
              </div>
            )}

            {/* Sanitized response body */}
            {selectedLog.responseBody && (
              <div className={styles.formGroup}>
                <label>Response Body Payload (Sanitized)</label>
                <pre className={styles.payloadBox}>
                  {JSON.stringify(selectedLog.responseBody, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={() => setSelectedLog(null)}>Close Inspector</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
