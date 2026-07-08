'use client';

/**
 * HollowPay — Security Audit Logs Page
 *
 * Renders an immutable security log audit timeline of critical actions,
 * actor IDs, timestamps, client IPs, and full metadata inspector dialogs.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from './page.module.css';

interface AuditLog {
  id: number;
  publicId: string;
  actorId: number | null;
  actorType: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  result: 'success' | 'failure';
  metadata: Record<string, any> | null;
  requestId: string;
  ipAddress: string | null;
  createdAt: string;
  actorEmail: string | null;
  actorName: string | null;
}

export default function AuditLogsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Fetch Audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/audit-logs?limit=100');
      const json = await res.json();
      if (res.ok) {
        setLogs(json.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Format action text helper
  const getActionLabel = (action: string) => {
    return action.replace(/_/g, ' ').toUpperCase();
  };

  // Filter logs locally based on search query and action dropdown
  const filteredLogs = logs.filter((log) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesAction = !actionFilter || log.action === actionFilter;
    if (!matchesAction) return false;
    
    if (!query) return true;
    return (
      log.action.toLowerCase().includes(query) ||
      (log.actorEmail && log.actorEmail.toLowerCase().includes(query)) ||
      (log.actorName && log.actorName.toLowerCase().includes(query)) ||
      log.publicId.toLowerCase().includes(query) ||
      (log.requestId && log.requestId.toLowerCase().includes(query))
    );
  });

  // Unique list of actions for dropdown filter
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>🛡️</span> Security Audit Logs
          </h1>
          <p className="body-sm mt-1 text-muted-foreground">
            View immutable historical logs of all sensitive merchant operations and administrative reviews.
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
              placeholder="Search by action, email, request ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.selectWrapper}>
            <select
              className={styles.filterSelect}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {getActionLabel(action)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && logs.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p className="body-sm text-muted-foreground mt-2">Loading audit logs…</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>
            No security audit logs found {searchQuery || actionFilter ? 'matching your filters' : ''}.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Result</th>
                  <th>Client IP</th>
                  <th>Request ID</th>
                  <th>Logged At</th>
                  <th style={{ textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const date = new Date(log.createdAt);
                  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <tr key={log.id}>
                      <td>
                        <strong className="monospace" style={{ fontSize: '0.8rem' }}>
                          {getActionLabel(log.action)}
                        </strong>
                        <div className="caption text-muted-foreground" style={{ fontSize: '0.65rem' }}>
                          {log.publicId}
                        </div>
                      </td>
                      <td>
                        {log.actorEmail ? (
                          <div>
                            <span className="body-xs font-semibold">{log.actorName || 'User'}</span>
                            <div className="caption text-muted-foreground" style={{ fontSize: '0.65rem' }}>
                              {log.actorEmail}
                            </div>
                          </div>
                        ) : (
                          <span className="body-xs text-muted-foreground italic">
                            {log.actorType === 'system' ? '💻 System' : '👤 Anonymous'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={log.result === 'success' ? styles.resultSuccess : styles.resultFailed}>
                          {log.result.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <code className="monospace" style={{ fontSize: '0.75rem' }}>
                          {log.ipAddress || '—'}
                        </code>
                      </td>
                      <td>
                        <code className="monospace" style={{ fontSize: '0.75rem' }}>
                          {log.requestId ? `${log.requestId.substring(0, 12)}…` : '—'}
                        </code>
                      </td>
                      <td className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                        {formattedDate} {formattedTime}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className={styles.inspectBtn}
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
              <div className={styles.modalTitle}>Audit Log Details</div>
              <button
                className={styles.closeModalBtn}
                onClick={() => setSelectedLog(null)}
              >
                ✕
              </button>
            </div>

            {/* Meta stats */}
            <div className={styles.grid2Col}>
              <div className={styles.formGroup}>
                <label>Audit Action</label>
                <div className="monospace body-xs font-semibold">
                  {getActionLabel(selectedLog.action)}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Execution Status</label>
                <div className="monospace body-xs">
                  <span className={selectedLog.result === 'success' ? styles.resultSuccess : styles.resultFailed} style={{ marginRight: 8 }}>
                    {selectedLog.result.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Actor</label>
                <div className="body-xs text-muted-foreground">
                  {selectedLog.actorEmail ? `${selectedLog.actorName} (${selectedLog.actorEmail})` : `System / ${selectedLog.actorType}`}
                </div>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Client IP Address</label>
                <code className="monospace body-xs">{selectedLog.ipAddress || '—'}</code>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Request ID</label>
                <code className="monospace body-xs">{selectedLog.requestId || '—'}</code>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Timestamp</label>
                <span className="body-xs text-muted-foreground">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </span>
              </div>
              {selectedLog.targetType && (
                <div className={styles.formGroup} style={{ marginTop: 8 }}>
                  <label>Target Context</label>
                  <span className="body-xs monospace">
                    {selectedLog.targetType.toUpperCase()}: {selectedLog.targetId}
                  </span>
                </div>
              )}
            </div>

            {/* Audit event metadata parameters */}
            <div className={styles.formGroup} style={{ marginTop: 16 }}>
              <label>Audit Metadata Context (Sanitized)</label>
              <pre className={styles.payloadBox}>
                {selectedLog.metadata
                  ? JSON.stringify(selectedLog.metadata, null, 2)
                  : 'No metadata context parameters recorded.'}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={() => setSelectedLog(null)}>Close Inspector</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
