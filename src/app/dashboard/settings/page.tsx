'use client';

/**
 * HollowPay — General Project Settings, Environments & Team Management
 *
 * Implements project name configurations, Live Mode validation requests,
 * and workspace team membership invites, roles, and revocation controls.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from '../business/profile/page.module.css';

interface TeamMember {
  id: number;
  userId: number;
  role: string;
  joinedAt: string;
  name: string | null;
  email: string;
  publicId: string;
}

interface PendingInvite {
  id: number;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedByName: string | null;
  invitedByEmail: string | null;
}

export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'team'>('general');
  const [loading, setLoading] = useState(true);
  
  // General settings state
  const [name, setName] = useState('');
  const [testMode, setTestMode] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [appStatus, setAppStatus] = useState<string>('not_requested');
  const [appReason, setAppReason] = useState<string | null>(null);
  
  // Team management state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvite[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('viewer');
  
  // Form submission / operations state
  const [saving, setSaving] = useState(false);
  const [requestingLive, setRequestingLive] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'developer' | 'viewer'>('developer');
  const [inviting, setInviting] = useState(false);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch project settings and live mode applications
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/dashboard/settings');
      const json = await res.json();
      if (res.ok && json.project) {
        setName(json.project.name || '');
        setTestMode(json.project.testModeEnabled);
        setLiveMode(json.project.liveModeEnabled);
      }

      const appRes = await fetch('/api/dashboard/settings/live-application');
      const appJson = await appRes.json();
      if (appRes.ok && appJson.application) {
        setAppStatus(appJson.application.status);
        setAppReason(appJson.application.reviewReason);
      }

      // Fetch team details
      const teamRes = await fetch('/api/dashboard/settings/team');
      const teamJson = await teamRes.json();
      if (teamRes.ok) {
        setMembers(teamJson.members || []);
        setInvitations(teamJson.invitations || []);
        setCurrentUserRole(teamJson.currentUserRole || 'viewer');
      }
    } catch (err) {
      console.error('Failed to load project settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Request Live Mode Activation
  const handleRequestLiveMode = async () => {
    setRequestingLive(true);
    setMessage(null);
    try {
      const res = await fetch('/api/dashboard/settings/live-application', {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok) {
        setAppStatus('pending_review');
        setMessage({ type: 'success', text: 'Live Mode compliance request submitted successfully.' });
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to submit Live Mode request.' });
      }
    } catch (err) {
      console.error('Failed to request live mode:', err);
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setRequestingLive(false);
    }
  };

  // Submit settings update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          test_mode: testMode,
          live_mode: liveMode,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Project configurations saved successfully.' });
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to save project settings.' });
      }
    } catch (err) {
      console.error('Failed to save project settings:', err);
      setMessage({ type: 'error', text: 'An unexpected connection error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  // Send Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/dashboard/settings/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setInviteEmail('');
        setMessage({ type: 'success', text: `Invitation sent to ${inviteEmail.trim()}.` });
        // Refresh lists
        const teamRes = await fetch('/api/dashboard/settings/team');
        const teamJson = await teamRes.json();
        if (teamRes.ok) {
          setMembers(teamJson.members || []);
          setInvitations(teamJson.invitations || []);
        }
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to send invitation.' });
      }
    } catch (err) {
      console.error('Invite failed:', err);
      setMessage({ type: 'error', text: 'Network connection issue.' });
    } finally {
      setInviting(false);
    }
  };

  // Revoke invite or member
  const handleRevoke = async (type: 'invite' | 'member', id: number) => {
    if (!confirm(`Are you sure you want to remove this ${type === 'invite' ? 'invitation' : 'workspace member'}?`)) {
      return;
    }

    setMessage(null);
    try {
      const res = await fetch('/api/dashboard/settings/team/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: json.message || 'Revocation successful.' });
        // Refresh lists
        const teamRes = await fetch('/api/dashboard/settings/team');
        const teamJson = await teamRes.json();
        if (teamRes.ok) {
          setMembers(teamJson.members || []);
          setInvitations(teamJson.invitations || []);
        }
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to revoke.' });
      }
    } catch (err) {
      console.error('Revoke request failed:', err);
      setMessage({ type: 'error', text: 'Connection failed.' });
    }
  };

  const isEditable = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className="h2">⚙️ Settings</h1>
        <p className="body-sm text-muted-foreground mt-1">
          Manage project workspace parameters, environment flags, and team membership controls.
        </p>
      </div>

      {loading ? (
        <div className={styles.card}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Tabs Switcher */}
          <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
            <button
              onClick={() => { setActiveTab('general'); setMessage(null); }}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'general' ? '2px solid var(--accent)' : 'none',
                color: activeTab === 'general' ? 'var(--foreground)' : 'var(--foreground-muted)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              General Config
            </button>
            <button
              onClick={() => { setActiveTab('team'); setMessage(null); }}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'team' ? '2px solid var(--accent)' : 'none',
                color: activeTab === 'team' ? 'var(--foreground)' : 'var(--foreground-muted)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Team Members
            </button>
          </div>

          {message && (
            <div
              className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}
              style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                borderRadius: 4,
                border: '1px solid',
                background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: message.type === 'success' ? '#10b981' : '#ef4444',
                borderColor: message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
              }}
            >
              {message.type === 'success' ? '✔️' : '⚠️'} {message.text}
            </div>
          )}

          {/* TAB 1: General configurations */}
          {activeTab === 'general' && (
            <div className={styles.card}>
              <div className={styles.sectionTitle}>Project Settings</div>

              <form onSubmit={handleSubmit} className={styles.form}>
                {/* Display Name */}
                <div className={styles.formGroup}>
                  <label htmlFor="projectName">Project Name</label>
                  <input
                    id="projectName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={saving || !isEditable}
                  />
                </div>

                {/* Environment active flags */}
                <div className={styles.formGroup} style={{ gap: 12 }}>
                  <label>Environment Modes</label>

                  {/* Test Mode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <input
                      type="checkbox"
                      checked={testMode}
                      onChange={(e) => setTestMode(e.target.checked)}
                      disabled={saving || !isEditable}
                      style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: isEditable ? 'pointer' : 'not-allowed' }}
                    />
                    <div>
                      <div className="body-sm" style={{ fontWeight: '600' }}>Enable Test Mode (Sandbox)</div>
                      <div className="caption text-muted-foreground">Allows creating simulated checkout sessions and making peer-to-peer verification claims.</div>
                    </div>
                  </div>

                  {/* Live Mode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', opacity: appStatus === 'approved' ? 1 : 0.75 }}>
                    <input
                      type="checkbox"
                      checked={liveMode && appStatus === 'approved'}
                      onChange={(e) => setLiveMode(e.target.checked)}
                      disabled={saving || appStatus !== 'approved' || !isEditable}
                      style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: appStatus === 'approved' && isEditable ? 'pointer' : 'not-allowed' }}
                    />
                    <div>
                      <div className="body-sm" style={{ fontWeight: '600' }}>Enable Live Mode (Production)</div>
                      <div className="caption text-muted-foreground">Enables live merchant claims and processes real UPI transfers. Requires founder compliance verification.</div>
                    </div>
                  </div>

                  {/* Live Mode Verification Status Box */}
                  <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="body-sm font-semibold">Live Mode Status:</div>
                        <div className="caption text-muted-foreground mt-1">
                          {appStatus === 'not_requested' && 'Your project is in sandbox/testing mode. To process live payments, you must apply for Live Mode.'}
                          {appStatus === 'pending_review' && 'Compliance application submitted. Our administrators are auditing your UPI payee configuration.'}
                          {appStatus === 'approved' && 'Congratulations! Your business details are verified. You can now toggle Live Mode.'}
                          {appStatus === 'rejected' && `Application rejected. Reason: "${appReason || 'Incomplete compliance verification documentation.'}"`}
                          {appStatus === 'suspended' && 'Live Mode access suspended. Please contact supervisor support for details.'}
                        </div>
                      </div>
                      <div style={{ marginLeft: 16 }}>
                        {appStatus === 'not_requested' && (
                          <Button type="button" onClick={handleRequestLiveMode} disabled={requestingLive || !isEditable}>
                            {requestingLive ? 'Applying...' : 'Request Activation'}
                          </Button>
                        )}
                        {appStatus === 'pending_review' && (
                          <Badge variant="warning">AWAITING REVIEW</Badge>
                        )}
                        {appStatus === 'approved' && (
                          <Badge variant="success">APPROVED</Badge>
                        )}
                        {appStatus === 'rejected' && (
                          <Button type="button" onClick={handleRequestLiveMode} disabled={requestingLive || !isEditable}>
                            {requestingLive ? 'Re-applying...' : 'Re-apply'}
                          </Button>
                        )}
                        {appStatus === 'suspended' && (
                          <Badge variant="danger">SUSPENDED</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {isEditable && (
                  <div className={styles.actions}>
                    <Button type="submit" disabled={saving || !name.trim()}>
                      {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 2: Team management */}
          {activeTab === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Invite Member form */}
              {isEditable && (
                <div className={styles.card}>
                  <div className={styles.sectionTitle}>Invite Team Member</div>
                  <form onSubmit={handleSendInvite} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginTop: 12 }}>
                    <div style={{ flex: 2 }}>
                      <Input
                        label="Email Address"
                        placeholder="developer@company.com"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="form-group">
                        <label className="label" style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: 4, display: 'block' }}>Role</label>
                        <select
                          className="input"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as any)}
                          style={{ height: 40, border: '1px solid var(--border)', background: 'var(--surface-subtle)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', width: '100%', padding: '0 12px' }}
                        >
                          <option value="admin">Administrator</option>
                          <option value="developer">Developer</option>
                          <option value="viewer">Read-Only Viewer</option>
                        </select>
                      </div>
                    </div>
                    <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                      {inviting ? 'Inviting...' : 'Send Invite'}
                    </Button>
                  </form>
                </div>
              )}

              {/* Members Table */}
              <div className={styles.card}>
                <div className={styles.sectionTitle}>Active Members</div>
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--foreground-muted)', fontSize: '0.85rem' }}>
                        <th style={{ padding: 12 }}>Name</th>
                        <th style={{ padding: 12 }}>Email</th>
                        <th style={{ padding: 12 }}>Role</th>
                        <th style={{ padding: 12 }}>Joined</th>
                        {isEditable && <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                          <td style={{ padding: 12, fontWeight: '600' }}>{m.name || 'Anonymous User'}</td>
                          <td style={{ padding: 12 }}>{m.email}</td>
                          <td style={{ padding: 12 }}>
                            <Badge variant={m.role === 'owner' ? 'success' : m.role === 'admin' ? 'warning' : 'default'}>
                              {m.role.toUpperCase()}
                            </Badge>
                          </td>
                          <td style={{ padding: 12, color: 'var(--foreground-muted)' }}>
                            {new Date(m.joinedAt).toLocaleDateString()}
                          </td>
                          {isEditable && (
                            <td style={{ padding: 12, textAlign: 'right' }}>
                              {m.role !== 'owner' && (
                                <button
                                  onClick={() => handleRevoke('member', m.id)}
                                  style={{
                                    background: 'none',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '2px 8px',
                                    fontSize: '0.75rem',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pending Invitations Table */}
              {invitations.length > 0 && (
                <div className={styles.card}>
                  <div className={styles.sectionTitle}>Pending Invitations</div>
                  <div style={{ overflowX: 'auto', marginTop: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--foreground-muted)', fontSize: '0.85rem' }}>
                          <th style={{ padding: 12 }}>Email</th>
                          <th style={{ padding: 12 }}>Role</th>
                          <th style={{ padding: 12 }}>Expires</th>
                          <th style={{ padding: 12 }}>Invited By</th>
                          {isEditable && <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {invitations.map((i) => (
                          <tr key={i.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                            <td style={{ padding: 12, fontWeight: '600' }}>{i.email}</td>
                            <td style={{ padding: 12 }}>
                              <Badge variant="default">{i.role.toUpperCase()}</Badge>
                            </td>
                            <td style={{ padding: 12, color: 'var(--foreground-muted)' }}>
                              {new Date(i.expiresAt).toLocaleDateString()}
                            </td>
                            <td style={{ padding: 12, color: 'var(--foreground-muted)' }}>
                              {i.invitedByName || i.invitedByEmail || 'System'}
                            </td>
                            {isEditable && (
                              <td style={{ padding: 12, textAlign: 'right' }}>
                                <button
                                  onClick={() => handleRevoke('invite', i.id)}
                                  style={{
                                    background: 'none',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '2px 8px',
                                    fontSize: '0.75rem',
                                    color: 'var(--foreground-muted)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}
    </div>
  );
}
