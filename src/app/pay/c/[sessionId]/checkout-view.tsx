/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
/**
 * HollowPay — Public Hosted Checkout Interactive View
 *
 * Implements the multi-step checkout wizard (Scan & Pay -> Proof Submission -> Verification Loader).
 * Integrates direct Cloudflare R2 binary screenshot uploads and a floating developer sandbox simulator.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input, Card } from '@/components/ui';
import { signal } from '@/lib/reticle';
import styles from './page.module.css';
import { formatCurrency } from '@/lib/utils/currency-formatter';

interface CheckoutViewProps {
  session: any;
  order: any;
  business: any;
  branding: any;
  upiId: string;
  payeeName: string;
  upiIntent: string;
  qrCodeData: string;
  conversionRate?: number;
  convertedAmountMinor?: number;
}

export default function CheckoutView({
  session,
  order,
  business,
  branding,
  upiId,
  payeeName,
  upiIntent,
  qrCodeData,
  conversionRate = 1,
  convertedAmountMinor,
}: CheckoutViewProps) {
  // Stepper state: 'pay' | 'claim' | 'verifying' | 'success' | 'rejected'
  const [step, setStep] = useState<'pay' | 'claim' | 'verifying' | 'success' | 'rejected'>('pay');
  const [claimedReference, setClaimedReference] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotKey, setScreenshotKey] = useState<string | null>(null);

  // Emit checkout opened signal when the view loads in 'pay' state
  useEffect(() => {
    if (step === 'pay') {
      signal('checkout:opened', { sessionId: session.publicId, amountMinor: order.amountMinor });
    }
  }, [step, session.publicId, order.amountMinor]);
  
  // Operational states
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const isTestMode = session.environment === 'test';

  // Format paise into standard INR format (e.g. 50000 -> ₹500.00)
  const formatAmount = (minorAmount: number) => {
    return formatCurrency(minorAmount, order.currency);
  };

  // Helper to handle client-side R2 file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Proof screenshot size must be less than 5 MB.');
      return;
    }

    // Validate type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file format. Please upload PNG, JPG, or WEBP.');
      return;
    }

    setScreenshotFile(file);
    setLoading(true);
    setUploadProgress(10); // Start progress indicators

    try {
      // 1. Request presigned upload URL
      const res = await fetch(`/api/v1/checkout-sessions/${session.publicId}/upload-url?content_type=${file.type}`);
      if (!res.ok) {
        throw new Error('Failed to acquire upload parameters.');
      }
      const data = await res.json();
      setUploadProgress(30);

      // 2. Perform direct binary PUT upload
      const uploadRes = await fetch(data.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Screenshot upload to object storage failed.');
      }

      setUploadProgress(100);
      setScreenshotKey(data.screenshot_key);
      console.log('Direct upload completed successfully:', data.screenshot_key);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload screenshot. Please try again.');
      setScreenshotFile(null);
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(null), 1500);
    }
  };

  // Poll session status when in 'verifying' step
  useEffect(() => {
    if (step !== 'verifying') return;

    let intervalId: NodeJS.Timeout;
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/v1/checkout-sessions/${session.publicId}/claim`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed') {
            signal('checkout:payment_confirmed', { sessionId: session.publicId });
            setStep('success');
            clearInterval(intervalId);
          } else if (data.status === 'cancelled') {
            setStep('rejected');
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }

      attempts++;
      if (attempts > 120) { // Timeout after 6 minutes
        clearInterval(intervalId);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 3000);

    return () => clearInterval(intervalId);
  }, [step, session.publicId]);

  // Auto-redirect to merchant on success
  useEffect(() => {
    if (step === 'success' && session.successUrl) {
      const timer = setTimeout(() => {
        window.location.href = session.successUrl;
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, session.successUrl]);

  // Submit payment UTR claim reference
  const handleClaimSubmit = async () => {
    if (!claimedReference.trim() || claimedReference.trim().length < 8) {
      setError('Please enter a valid 12-digit transaction UTR / Reference number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/checkout-sessions/${session.publicId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claimed_reference: claimedReference.trim(),
          screenshot_key: screenshotKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit payment claim.');
      }

      signal('checkout:claim_submitted', {
        sessionId: session.publicId,
        utr: claimedReference.trim(),
        hasScreenshot: !!screenshotKey,
      });

      if (data.status === 'confirmed') {
        signal('checkout:payment_confirmed', { sessionId: session.publicId });
        setStep('success');
      } else {
        setStep('verifying');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to record transaction claim.');
    } finally {
      setLoading(false);
    }
  };

  // Simulate verification confirmation in Test Mode
  const handleSimulateConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/checkout-sessions/${session.publicId}/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'confirm' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulation confirmed trigger failed.');
      }
      signal('checkout:payment_confirmed', { sessionId: session.publicId });
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Simulation confirmation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Simulate verification rejection in Test Mode
  const handleSimulateReject = async () => {
    setError(null);
    setLoading(true);
    const reason = 'Sandbox: test reference could not be located in simulated bank statements.';
    try {
      const res = await fetch(`/api/v1/checkout-sessions/${session.publicId}/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject', reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulation rejected trigger failed.');
      }
      signal('checkout:payment_rejected', { sessionId: session.publicId, reason });
      setRejectReason(reason);
      setStep('rejected');
    } catch (err: any) {
      setError(err.message || 'Simulation rejection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.checkoutContainer}>
      {/* Test Mode Top Ribbon Warning */}
      {isTestMode && (
        <div className={styles.testRibbon}>
          <span>🧪 TEST MODE CHECKOUT — No real money will be transferred</span>
        </div>
      )}

      {/* Main card */}
      <Card className={styles.checkoutCard}>
        {/* Business Header */}
        <div className={styles.header}>
          {branding?.logoObjectKey ? (
            <img src={`/api/assets/${branding.logoObjectKey}`} alt={business.name} className={styles.logo} />
          ) : (
            <div className={styles.logoPlaceholder}>
              {business.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className={styles.merchantInfo}>
            <h3 className="h4">{business.name}</h3>
            <span className="caption">{business.website}</span>
          </div>
        </div>

        {/* Order details header banner */}
        <div className={styles.orderBanner}>
          <div className="flex justify-between items-center">
            <div>
              <span className="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>Total Amount</span>
              <h2 className="h2 text-white">{formatAmount(order.amountMinor)}</h2>
            </div>
            <div className="text-right">
              <span className="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>Order Reference</span>
              <p className="body-sm font-semibold text-white">{order.merchantOrderId || order.publicId.substring(0, 14)}</p>
            </div>
          </div>
          {order.description && (
            <p className="body-xs mt-3 text-white opacity-80" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-2)' }}>
              {order.description}
            </p>
          )}
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* ============================================================
            STEP 1: SCAN AND PAY
            ============================================================ */}
        {step === 'pay' && (
          <div className={styles.viewContent}>
            <h3 className="h4 text-center">Scan & Pay via UPI</h3>
            <p className="body-sm text-center opacity-80 mt-1">
              Transfer funds peer-to-peer directly to the merchant.
            </p>

            {order.currency.toUpperCase() !== 'INR' && convertedAmountMinor && (
              <div 
                style={{ 
                  margin: '12px 0', 
                  padding: '12px 14px', 
                  background: 'rgba(59, 130, 246, 0.08)', 
                  border: '1px solid rgba(59, 130, 246, 0.2)', 
                  borderRadius: '8px',
                  color: '#93c5fd',
                  fontSize: '0.8rem',
                  lineHeight: '1.4'
                }}
              >
                <strong>💱 Currency Conversion Alert</strong>
                <p style={{ marginTop: 4, opacity: 0.9 }}>
                  This transaction is valued at <strong>{formatAmount(order.amountMinor)}</strong>. 
                  Since UPI operates exclusively in INR, you are paying the equivalent of <strong>{formatCurrency(convertedAmountMinor, 'INR')}</strong> (calculated at a fixed rate of 1 {order.currency} = {conversionRate} INR).
                </p>
              </div>
            )}

            {/* QR Render block */}
            <div className={styles.qrBlock}>
              {qrCodeData ? (
                <img src={qrCodeData} alt="UPI QR Code" className={styles.qrImage} />
              ) : (
                <div className={styles.qrPlaceholder}>Loading QR Code...</div>
              )}
              <span className="caption mt-2">Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)</span>
            </div>

            {/* Mobile UPI Intent deep link action */}
            <div className={styles.mobileAction}>
              <a href={upiIntent} className={styles.upiBtn}>
                📲 Pay via Mobile UPI App
              </a>
            </div>

            <div className={styles.detailsBlock}>
              <div className="flex justify-between py-2" style={{ borderBottom: '1px dashed var(--border)' }}>
                <span className="caption">UPI VPA:</span>
                <span className="body-xs font-semibold">{upiId}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="caption">Payee Name:</span>
                <span className="body-xs font-semibold">{payeeName}</span>
              </div>
            </div>

            <Button className="w-full mt-6" onClick={() => setStep('claim')}>
              I have paid, submit details
            </Button>
          </div>
        )}

        {/* ============================================================
            STEP 2: SUBMIT TRANSACTION CLAIM REFERENCE
            ============================================================ */}
        {step === 'claim' && (
          <div className={styles.viewContent}>
            <h3 className="h4">Submit Payment Proof</h3>
            <p className="body-sm opacity-80 mt-1">
              Enter your UPI UTR reference number to claim payment confirmation.
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <Input
                label="UPI Transaction ID / Ref Number (UTR)"
                placeholder="12-digit reference (e.g. 206812345678)"
                value={claimedReference}
                onChange={(e) => setClaimedReference(e.target.value)}
                maxLength={24}
                required
                data-testid="checkout-utr-input"
              />

              {/* Dynamic Image upload */}
              <div className="form-group">
                <label className="label">Attachment Proof (Optional Screenshot)</label>
                <div className={styles.fileDropzone}>
                  <input
                    type="file"
                    id="screenshot"
                    className={styles.fileInput}
                    onChange={handleFileChange}
                    accept="image/*"
                    disabled={loading}
                    data-testid="checkout-screenshot-upload"
                  />
                  <label htmlFor="screenshot" className={styles.fileLabel}>
                    {screenshotFile ? (
                      <span className="body-xs font-semibold text-emerald-400">
                        ✔️ {screenshotFile.name} (Ready)
                      </span>
                    ) : (
                      <span className="body-xs opacity-60">
                        📸 Click to upload screenshot / receipt (Max 5MB)
                      </span>
                    )}
                  </label>
                </div>
                {uploadProgress !== null && (
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setStep('pay')}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleClaimSubmit} disabled={loading} data-testid="checkout-submit-btn">
                {loading ? 'Submitting...' : 'Verify Claim'}
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 3: WAITING FOR VERIFICATION
            ============================================================ */}
        {step === 'verifying' && (
          <div className={`${styles.viewContent} text-center`}>
            <div className={styles.loaderContainer}>
              <div className={styles.spinLoader}></div>
            </div>
            <h3 className="h4 mt-6">Verifying your transaction</h3>
            <p className="body-sm opacity-85 mt-2">
              We have received your claim with reference <strong>{claimedReference}</strong>.
            </p>
            <p className="body-xs opacity-75 mt-1">
              Your payment destination is direct. We are verifying credentials with <strong>{business.name}</strong>. This usually resolves in a few minutes.
            </p>

            <div className={styles.noticeBox}>
              <p className="caption text-left font-semibold">Verification instructions:</p>
              <ul className="body-xs text-left mt-2 flex flex-col gap-1" style={{ listStyleType: 'disc', paddingLeft: 'var(--space-4)' }}>
                <li>Do not close or reload this window.</li>
                <li>Your order will complete automatically once confirmed.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 4: SUCCESS COMPLETED
            ============================================================ */}
        {step === 'success' && (
          <div className={`${styles.viewContent} text-center`}>
            <div className={styles.successIcon}>✓</div>
            <h3 className="h3 mt-6">Payment Confirmed!</h3>
            <p className="body-sm opacity-85 mt-2">
              Your payment has been successfully verified.
            </p>
            <div className={styles.detailsBlock} style={{ margin: 'var(--space-6) 0' }}>
              <div className="flex justify-between py-1">
                <span className="caption">Ref ID:</span>
                <span className="body-xs font-semibold">{claimedReference || 'Verified'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="caption">Status:</span>
                <span className="body-xs font-semibold text-emerald-400">Completed</span>
              </div>
            </div>

            {session.successUrl ? (
              <Button className="w-full" onClick={() => window.location.href = session.successUrl}>
                Return to Merchant
              </Button>
            ) : (
              <p className="caption">You may now close this browser tab safely.</p>
            )}
          </div>
        )}

        {/* ============================================================
            STEP 5: REJECTED CLAIMS
            ============================================================ */}
        {step === 'rejected' && (
          <div className={`${styles.viewContent} text-center`}>
            <div className={styles.rejectIcon}>❌</div>
            <h3 className="h3 mt-6">Verification Failed</h3>
            <p className="body-sm opacity-85 mt-2">
              The merchant was unable to verify your claim.
            </p>
            {rejectReason && (
              <div className={styles.reasonAlert}>
                <p className="body-xs"><strong>Reason:</strong> {rejectReason}</p>
              </div>
            )}

            <Button className="w-full mt-6" onClick={() => setStep('claim')}>
              Try another reference number
            </Button>
          </div>
        )}
      </Card>

      {/* ============================================================
          SANDBOX TEST MODE SIMULATOR WIDGET (Glassmorphic console overlay)
          ============================================================ */}
      {isTestMode && (step === 'verifying' || step === 'claim') && (
        <div className={styles.simulatorConsole}>
          <div className={styles.consoleHeader}>
            <span style={{ fontSize: '1.2rem' }}>🛠️</span>
            <div>
              <p className="body-sm font-bold text-white">Developer Sandbox Console</p>
              <span className="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>Simulate merchant dashboard confirmation triggers</span>
            </div>
          </div>
          <div className="flex gap-4 mt-4 w-full">
            <Button
              className="flex-1"
              style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}
              onClick={handleSimulateConfirm}
              disabled={loading}
            >
              Simulate Approve
            </Button>
            <Button
              className="flex-1"
              style={{ backgroundColor: 'var(--danger-foreground)', borderColor: 'var(--danger-foreground)' }}
              onClick={handleSimulateReject}
              disabled={loading}
            >
              Simulate Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
