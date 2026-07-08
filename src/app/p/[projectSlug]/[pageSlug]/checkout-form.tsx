'use client';

/**
 * HollowPay — Client Side Checkout Form for Public Payment Pages
 *
 * Implements AJAX submit bindings, redirects to hosted QR checkout scanner,
 * validation errors, and loading state animations.
 */

import React, { useState } from 'react';
import styles from './page.module.css';

interface CheckoutFormProps {
  pagePublicId: string;
  collectPhone: boolean;
}

export default function CheckoutForm({ pagePublicId, collectPhone }: CheckoutFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/p/payment-pages/${pagePublicId}/checkout?env=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: collectPhone ? phone.trim() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to initialize payment.');
      }

      // Redirect directly to hosted checkout screen
      window.location.href = json.redirect_url;
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formTitle}>Billing Details</div>

      {error && (
        <div className={styles.errorBox}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Customer Full Name */}
      <div className={styles.inputGroup}>
        <label htmlFor="name">Full Name</label>
        <input
          id="name"
          type="text"
          placeholder="E.g. Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {/* Customer Email Address */}
      <div className={styles.inputGroup}>
        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          type="email"
          placeholder="jane@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {/* Customer Mobile Phone */}
      {collectPhone && (
        <div className={styles.inputGroup}>
          <label htmlFor="phone">Mobile Phone</label>
          <input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            disabled={loading}
          />
        </div>
      )}

      <button className={styles.submitBtn} type="submit" disabled={loading}>
        {loading ? (
          <>
            <div className={styles.spinner}></div>
            <span>Processing...</span>
          </>
        ) : (
          <span>Proceed to Scan & Pay</span>
        )}
      </button>
    </form>
  );
}
