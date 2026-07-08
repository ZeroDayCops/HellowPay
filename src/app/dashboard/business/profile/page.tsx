'use client';

/**
 * HollowPay — Business Profiles Settings & Branding Customizer
 *
 * Implements fields config (Support Email, Support Phone, Website URL)
 * and dynamic primary theme color accent picker controls.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from './page.module.css';

export default function BusinessProfilePage() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4A154B');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch business profile config
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/business/profile');
      const json = await res.json();
      if (res.ok && json.business) {
        setName(json.business.name || '');
        setWebsite(json.business.website || '');
        setSupportEmail(json.business.supportEmail || '');
        setSupportPhone(json.business.supportPhone || '');
        setPrimaryColor(json.branding?.primaryColor || '#4A154B');
      }
    } catch (err) {
      console.error('Failed to load business profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Submit profile details update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/dashboard/business/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || undefined,
          support_email: supportEmail.trim() || undefined,
          support_phone: supportPhone.trim() || undefined,
          primary_color: primaryColor.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Business profile and branding style settings updated successfully.' });
      } else {
        setMessage({ type: 'error', text: json.error || 'Failed to update profile settings.' });
      }
    } catch (err) {
      console.error('Failed to save profile settings:', err);
      setMessage({ type: 'error', text: 'An unexpected connection error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <h1 className="h2">🏢 Business Profile</h1>
        <p className="body-sm text-muted-foreground mt-1">
          Configure support contact parameters and customize branding primary color accents for customer checkout interfaces.
        </p>
      </div>

      {loading ? (
        <div className={styles.card}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Company Configurations</div>

          <form onSubmit={handleSubmit} className={styles.form}>
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

            {/* Display Name */}
            <div className={styles.formGroup}>
              <label htmlFor="name">Business Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            {/* Website URL */}
            <div className={styles.formGroup}>
              <label htmlFor="website">Website URL</label>
              <input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Support Email */}
            <div className={styles.formGroup}>
              <label htmlFor="supportEmail">Support Email</label>
              <input
                id="supportEmail"
                type="email"
                placeholder="support@example.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Support Phone */}
            <div className={styles.formGroup}>
              <label htmlFor="supportPhone">Support Mobile Phone</label>
              <input
                id="supportPhone"
                type="tel"
                placeholder="+91 99999 88888"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Branding Accent Hex Color Picker */}
            <div className={styles.formGroup}>
              <label>Checkout Theme Accent Color</label>
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={saving}
                  style={{ width: '40px', height: '40px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  placeholder="#4A154B"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  maxLength={7}
                  disabled={saving}
                  style={{ flex: 1 }}
                />
                <div
                  className={styles.colorIndicator}
                  style={{ backgroundColor: primaryColor }}
                ></div>
              </div>
              <span className="caption text-muted-foreground" style={{ marginTop: 2 }}>
                Used as the primary color accent for payment pages, links, and transaction scanner views.
              </span>
            </div>

            <div className={styles.actions}>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
