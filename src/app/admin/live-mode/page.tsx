'use client';

/**
 * HollowPay — Admin Live Mode Applications Console
 *
 * Implements administrative listing, status sorting filters, and interactive Action
 * Modals for approving or rejecting compliance applications with logged reasons.
 */

import React, { useEffect, useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import styles from '../page.module.css';

interface LiveApplication {
  applicationId: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'suspended';
  requestedAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
  projectName: string;
  projectPublicId: string;
  businessName: string;
  businessEmail: string | null;
  applicantName: string | null;
  applicantEmail: string | null;
}

export default function AdminLiveApplicationsPage() {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<LiveApplication[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review Modal State
  const [selectedApp, setSelectedApp] = useState<LiveApplication | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Administrative Notes Timeline State
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  // Fetch annotations timeline for selected application
  const fetchNotes = async (appId: number) => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/admin/live-applications/${appId}/notes`);
      const json = await res.json();
      if (res.ok) {
        setNotes(json.notes || []);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Submit new annotation note
  const handleAddNote = async (appId: number) => {
    if (!newNoteContent.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/admin/live-applications/${appId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });
      if (res.ok) {
        setNewNoteContent('');
        fetchNotes(appId);
      }
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  // Load notes on detail modal mount
  useEffect(() => {
    if (selectedApp) {
      fetchNotes(selectedApp.applicationId);
    } else {
      setNotes([]);
      setNewNoteContent('');
    }
  }, [selectedApp]);

  const fetchApplications = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/live-applications');
      const json = await res.json();
      if (res.ok) {
        setApplications(json.applications || []);
      } else {
        setErrorMessage(json.error || 'Failed to retrieve applications.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network connection error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleReviewAction = async (action: 'approve' | 'reject') => {
    if (!selectedApp) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/live-applications/${selectedApp.applicationId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: reviewReason.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setSelectedApp(null);
        setReviewReason('');
        fetchApplications();
      } else {
        alert(json.error || 'Failed to save review action.');
      }
    } catch (err) {
      console.error(err);
      alert('A network connection error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter application sets
  const filteredApps = applications.filter((app) => {
    if (activeTab === 'pending') return app.status === 'pending_review';
    if (activeTab === 'approved') return app.status === 'approved';
    if (activeTab === 'rejected') return app.status === 'rejected' || app.status === 'suspended';
    return false;
  });

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h1 className="h2">⚡ Live Mode Applications</h1>
        <p className="body-sm mt-1">
          Review and approve merchant projects requesting access to Live Mode production transactions.
        </p>
      </div>

      {errorMessage && (
        <div className="alert alert-danger" style={{ marginBottom: 24, padding: 12, borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'pending' ? 'var(--foreground)' : 'var(--muted-foreground)',
            fontWeight: activeTab === 'pending' ? '600' : '400',
            borderBottom: activeTab === 'pending' ? '2px solid var(--accent)' : 'none',
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Awaiting Review ({applications.filter(a => a.status === 'pending_review').length})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'approved' ? 'var(--foreground)' : 'var(--muted-foreground)',
            fontWeight: activeTab === 'approved' ? '600' : '400',
            borderBottom: activeTab === 'approved' ? '2px solid var(--accent)' : 'none',
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Approved ({applications.filter(a => a.status === 'approved').length})
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'rejected' ? 'var(--foreground)' : 'var(--muted-foreground)',
            fontWeight: activeTab === 'rejected' ? '600' : '400',
            borderBottom: activeTab === 'rejected' ? '2px solid var(--accent)' : 'none',
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Rejected/Suspended ({applications.filter(a => a.status === 'rejected' || a.status === 'suspended').length})
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className={styles.spinner} style={{ margin: '0 auto' }}></div>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}>
          No applications located in this section.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className={styles.table} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>
                <th style={{ padding: '12px 16px' }}>Business</th>
                <th style={{ padding: '12px 16px' }}>Project</th>
                <th style={{ padding: '12px 16px' }}>Applicant</th>
                <th style={{ padding: '12px 16px' }}>Requested At</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((app) => (
                <tr key={app.applicationId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <strong>{app.businessName}</strong>
                    <div className="caption text-muted-foreground">{app.businessEmail || 'No business email'}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <code>{app.projectName}</code>
                    <div className="caption text-muted-foreground">{app.projectPublicId}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {app.applicantName || 'Anonymous'}
                    <div className="caption text-muted-foreground">{app.applicantEmail}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>
                    {new Date(app.requestedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {app.status === 'pending_review' && <Badge variant="warning">PENDING</Badge>}
                    {app.status === 'approved' && <Badge variant="success">APPROVED</Badge>}
                    {app.status === 'rejected' && <Badge variant="danger">REJECTED</Badge>}
                    {app.status === 'suspended' && <Badge variant="danger">SUSPENDED</Badge>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {app.status === 'pending_review' ? (
                      <Button size="sm" onClick={() => setSelectedApp(app)}>
                        Review & Action
                      </Button>
                    ) : app.status === 'approved' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        style={{ color: 'var(--danger-foreground)' }}
                        onClick={() => {
                          setSelectedApp(app);
                          setReviewReason('Manual suspension due to system administrative audit.');
                        }}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <span className="caption text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal Dialog Overlay */}
      {selectedApp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setSelectedApp(null)}
        >
          <div
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              maxWidth: 500,
              width: '100%',
              boxShadow: '0 20px 48px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="h4" style={{ marginBottom: 12 }}>Review Live Activation Request</h3>
            <p className="body-sm text-muted-foreground" style={{ marginBottom: 16 }}>
              Reviewing compliance details for business <strong>{selectedApp.businessName}</strong>, project <code>{selectedApp.projectName}</code>.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="body-xs font-semibold" style={{ display: 'block', marginBottom: 6 }}>
                Reason for Approval / Rejection (Optional for Approvals, Required for Rejections):
              </label>
              <textarea
                style={{
                  width: '100%',
                  height: 90,
                  padding: 8,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  resize: 'none',
                }}
                placeholder="Details of audit, missing configurations, compliance issues, etc."
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Internal Audit Annotations Timeline */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
              <span className="body-xs font-semibold" style={{ display: 'block', marginBottom: 8, color: 'var(--foreground-muted)' }}>
                🛡️ Internal Admin Notes ({notes.length})
              </span>

              {notes.length > 0 && (
                <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, paddingRight: 4 }}>
                  {notes.map((n) => (
                    <div key={n.id} style={{ background: 'var(--surface-subtle)', padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <p className="caption font-semibold" style={{ color: 'var(--foreground)' }}>{n.content}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                        <span>By {n.authorName || n.authorEmail}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Add compliance notes or observation logs..."
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--foreground)',
                    fontSize: '0.8rem',
                  }}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  disabled={addingNote}
                />
                <Button size="sm" onClick={() => handleAddNote(selectedApp.applicationId)} disabled={addingNote || !newNoteContent.trim()}>
                  {addingNote ? 'Saving...' : 'Add Note'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedApp(null);
                  setReviewReason('');
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                style={{ color: 'var(--danger-foreground)', borderColor: 'rgba(239,68,68,0.2)' }}
                onClick={() => handleReviewAction('reject')}
                disabled={submitting}
              >
                Reject Request
              </Button>
              <Button
                onClick={() => handleReviewAction('approve')}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Approve & Enable'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
