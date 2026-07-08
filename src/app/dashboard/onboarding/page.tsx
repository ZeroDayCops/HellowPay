'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitOnboarding } from './actions';
import { Button, Input, Card, Badge } from '@/components/ui';
import styles from './page.module.css';

const steps = [
  { num: 1, label: 'Workspace' },
  { num: 2, label: 'Business Profile' },
  { num: 3, label: 'Branding' },
  { num: 4, label: 'Payment Dest' },
  { num: 5, label: 'Project Info' },
  { num: 6, label: 'API Credentials' },
  { num: 7, label: 'Review' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invitations State
  const [invites, setInvites] = useState<any[]>([]);
  const [checkingInvites, setCheckingInvites] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    workspaceName: '',
    workspaceSlug: '',
    businessName: '',
    businessCategory: 'SaaS / Digital Products',
    businessWebsite: '',
    businessSupportEmail: '',
    brandingColor: '#4A154B', // Aubergine default
    brandingLogoKey: '',
    upiId: '',
    payeeName: '',
    projectName: '',
    projectWebsite: '',
  });

  // Generated Keys State (received after transaction submit)
  const [apiKeys, setApiKeys] = useState({
    publishableKey: '',
    secretKey: '',
  });
  const [copiedPub, setCopiedPub] = useState(false);
  const [copiedSec, setCopiedSec] = useState(false);

  // Check pending invitations matching current user email
  useEffect(() => {
    async function checkInvitations() {
      try {
        const res = await fetch('/api/dashboard/onboarding/invitations');
        const json = await res.json();
        if (res.ok && json.invitations) {
          setInvites(json.invitations);
        }
      } catch (err) {
        console.error('Failed to query invitations:', err);
      } finally {
        setCheckingInvites(false);
      }
    }
    checkInvitations();
  }, []);

  // Accept Invite handler
  const handleAcceptInvite = async (inviteId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/onboarding/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json();
      if (res.ok) {
        // Redirect directly to dashboard on successful join!
        router.push('/dashboard');
      } else {
        setError(json.error || 'Failed to accept invitation.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      setError('Connection failure. Please try again.');
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-generate slug from workspace name if editing workspace name
      if (field === 'workspaceName' && !prev.workspaceSlug) {
        next.workspaceSlug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
      }
      return next;
    });
  };

  const handleNext = () => {
    setError(null);

    // Basic Validation per step
    if (currentStep === 1) {
      if (!formData.workspaceName.trim()) return setError('Workspace Name is required.');
      if (!formData.workspaceSlug.trim()) return setError('Workspace Slug is required.');
    }
    if (currentStep === 2) {
      if (!formData.businessName.trim()) return setError('Business Legal Name is required.');
      if (!formData.businessWebsite.trim()) return setError('Website URL is required.');
      if (!formData.businessSupportEmail.trim()) return setError('Support Email is required.');
    }
    if (currentStep === 4) {
      if (!formData.upiId.trim()) return setError('UPI ID / VPA is required.');
      if (!formData.payeeName.trim()) return setError('Payee Name is required.');
      if (!formData.upiId.includes('@')) return setError('Please enter a valid UPI ID (e.g. name@bank).');
    }
    if (currentStep === 5) {
      if (!formData.projectName.trim()) return setError('Project Name is required.');
      if (!formData.projectWebsite.trim()) return setError('Project Website is required.');
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const result = await submitOnboarding(formData);

    if (result.success) {
      const successResult = result as { testPublishableKey: string; testSecretKey: string };
      setApiKeys({
        publishableKey: successResult.testPublishableKey || '',
        secretKey: successResult.testSecretKey || '',
      });
      // Move to Step 6 (API Credentials display)
      setCurrentStep(6);
    } else {
      const errorResult = result as { error: string };
      setError(errorResult.error || 'Failed to submit onboarding details.');
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string, type: 'pub' | 'sec') => {
    navigator.clipboard.writeText(text);
    if (type === 'pub') {
      setCopiedPub(true);
      setTimeout(() => setCopiedPub(false), 2000);
    } else {
      setCopiedSec(true);
      setTimeout(() => setCopiedSec(false), 2000);
    }
  };

  if (checkingInvites) {
    return (
      <div className={styles.container}>
        <Card className={styles.card}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p className="body-sm text-muted-foreground mt-3">Checking for pending workspace invitations…</p>
          </div>
        </Card>
      </div>
    );
  }

  if (invites.length > 0) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: '3.5rem' }}>👋</span>
          <h1 className="h2 mt-2">Welcome to HollowPay</h1>
          <p className="body-sm mt-1 text-muted-foreground">
            You have been invited to join an existing workspace. Accept below to bypass onboarding.
          </p>
        </div>

        <Card className={styles.card}>
          {error && (
            <div className={styles.errorAlert} style={{ marginBottom: 16 }}>
              <span>⚠️ {error}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {invites.map((invite) => (
              <div
                key={invite.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 16,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-subtle)',
                }}
              >
                <div>
                  <h3 className="body-sm font-semibold">Join &ldquo;{invite.workspaceName}&rdquo;</h3>
                  <p className="caption text-muted-foreground mt-1">
                    Role: <Badge variant="default">{invite.role.toUpperCase()}</Badge>
                  </p>
                </div>
                <Button onClick={() => handleAcceptInvite(invite.id)} disabled={loading}>
                  {loading ? 'Joining…' : 'Accept & Join'}
                </Button>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8, textAlign: 'center' }}>
              <span className="caption text-muted-foreground">
                Or, if you want to create a brand new workspace instead:
              </span>
              <div style={{ marginTop: 12 }}>
                <Button variant="secondary" onClick={() => setInvites([])} disabled={loading}>
                  Create New Workspace
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Step Indicator */}
      <div className={styles.stepper}>
        {steps.map((s) => (
          <div
            key={s.num}
            className={`${styles.step} ${currentStep === s.num ? styles.active : ''} ${
              currentStep > s.num ? styles.completed : ''
            }`}
          >
            <div className={styles.stepCircle}>
              {currentStep > s.num ? '✓' : s.num}
            </div>
            <span className={styles.stepLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      <Card className={styles.card}>
        {error && (
          <div className={styles.errorAlert}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* STEP 1: Workspace Details */}
        {currentStep === 1 && (
          <div className={styles.stepContent}>
            <h2 className="h3">Setup your Workspace</h2>
            <p className="body-sm mt-1">
              Workspaces are the top-level container for your businesses and teams.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <Input
                label="Workspace Name"
                placeholder="e.g. ZeroDayCops Team"
                value={formData.workspaceName}
                onChange={(e) => updateField('workspaceName', e.target.value)}
                required
              />
              <Input
                label="Workspace URL Slug"
                placeholder="e.g. zerodaycops-team"
                value={formData.workspaceSlug}
                onChange={(e) => updateField('workspaceSlug', e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* STEP 2: Business Profile */}
        {currentStep === 2 && (
          <div className={styles.stepContent}>
            <h2 className="h3">Business Profile</h2>
            <p className="body-sm mt-1">Provide legal and support credentials for your business.</p>
            <div className="mt-6 flex flex-col gap-4">
              <Input
                label="Legal Business Name"
                placeholder="e.g. ZeroDayCops Private Limited"
                value={formData.businessName}
                onChange={(e) => updateField('businessName', e.target.value)}
                required
              />
              <div className="form-group">
                <label className="label">Business Category</label>
                <select
                  className="input"
                  value={formData.businessCategory}
                  onChange={(e) => updateField('businessCategory', e.target.value)}
                >
                  <option value="SaaS / Digital Products">SaaS / Digital Products</option>
                  <option value="E-Commerce">E-Commerce</option>
                  <option value="Education / Courseware">Education / Courseware</option>
                  <option value="Consulting / Freelancing">Consulting / Freelancing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <Input
                label="Business Website URL"
                placeholder="https://zerodaycops.in"
                value={formData.businessWebsite}
                onChange={(e) => updateField('businessWebsite', e.target.value)}
                required
              />
              <Input
                label="Support Contact Email"
                placeholder="support@zerodaycops.in"
                type="email"
                value={formData.businessSupportEmail}
                onChange={(e) => updateField('businessSupportEmail', e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* STEP 3: Business Branding */}
        {currentStep === 3 && (
          <div className={styles.stepContent}>
            <h2 className="h3">Branding & Aesthetics</h2>
            <p className="body-sm mt-1">Configure your brand assets for checkouts and payment pages.</p>
            <div className="mt-6 flex flex-col gap-4">
              <div className="form-group">
                <label className="label">Primary Color Theme</label>
                <div className={styles.colorPickerWrapper}>
                  <input
                    type="color"
                    className={styles.colorPicker}
                    value={formData.brandingColor}
                    onChange={(e) => updateField('brandingColor', e.target.value)}
                  />
                  <Input
                    placeholder="#4A154B"
                    value={formData.brandingColor}
                    onChange={(e) => updateField('brandingColor', e.target.value)}
                  />
                </div>
              </div>
              <Input
                label="Branding Logo (Object Storage Key / Sim)"
                placeholder="e.g. logos/brand-icon.png"
                value={formData.brandingLogoKey}
                onChange={(e) => updateField('brandingLogoKey', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* STEP 4: Payment Destination */}
        {currentStep === 4 && (
          <div className={styles.stepContent}>
            <h2 className="h3">Payment Destination (UPI configuration)</h2>
            <p className="body-sm mt-1">
              Money goes directly here. HollowPay never handles or keeps your funds.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <Input
                label="Your UPI ID / VPA"
                placeholder="e.g. zerodaycops@okhdfcbank"
                value={formData.upiId}
                onChange={(e) => updateField('upiId', e.target.value)}
                required
              />
              <Input
                label="Payee Account Name"
                placeholder="e.g. ZeroDayCops Private Limited"
                value={formData.payeeName}
                onChange={(e) => updateField('payeeName', e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* STEP 5: Project details & Submit */}
        {currentStep === 5 && (
          <div className={styles.stepContent}>
            <h2 className="h3">Create your First Project</h2>
            <p className="body-sm mt-1">
              Projects contain API keys, checkout sessions, and webhook logs.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <Input
                label="Project Name"
                placeholder="e.g. ZeroDayCops API Store"
                value={formData.projectName}
                onChange={(e) => updateField('projectName', e.target.value)}
                required
              />
              <Input
                label="Project Integration Domain / Website"
                placeholder="https://store.zerodaycops.in"
                value={formData.projectWebsite}
                onChange={(e) => updateField('projectWebsite', e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* STEP 6: Generated API keys display (Non-editable) */}
        {currentStep === 6 && (
          <div className={styles.stepContent}>
            <div className="text-center">
              <span style={{ fontSize: '3rem' }}>🔑</span>
              <h2 className="h3 mt-4">Your Developer Credentials</h2>
              <p className="body-sm mt-1">
                We have initialized your project and generated your first set of Test API Keys.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <div className={styles.keyDisplay}>
                <label className="caption">Test Publishable Key</label>
                <div className={styles.keyBox}>
                  <code>{apiKeys.publishableKey}</code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyToClipboard(apiKeys.publishableKey, 'pub')}
                  >
                    {copiedPub ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className={styles.keyDisplay}>
                <label className="caption" style={{ color: 'var(--danger-foreground)' }}>
                  Test Secret Key (SAVE THIS NOW — shown only once)
                </label>
                <div className={styles.keyBox}>
                  <code>{apiKeys.secretKey}</code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyToClipboard(apiKeys.secretKey, 'sec')}
                  >
                    {copiedSec ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: Final onboarding checklist / review */}
        {currentStep === 7 && (
          <div className={styles.stepContent}>
            <div className="text-center">
              <span style={{ fontSize: '3.5rem' }}>🚀</span>
              <h2 className="h3 mt-4">Configuration Review</h2>
              <p className="body-sm mt-1">Confirm and complete your HollowPay onboarding.</p>
            </div>

            <div className={styles.summaryList}>
              <div className={styles.summaryItem}>
                <span className="caption">Workspace:</span>
                <span className="body-sm font-semibold">{formData.workspaceName}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className="caption">Business Name:</span>
                <span className="body-sm font-semibold">{formData.businessName}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className="caption">UPI Destination:</span>
                <span className="body-sm font-semibold">{formData.upiId}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className="caption">Default Project:</span>
                <span className="body-sm font-semibold">{formData.projectName}</span>
              </div>
            </div>

            <div className={styles.noticeBox}>
              <h4 className="h4">Next Steps:</h4>
              <ul className="body-sm mt-2 flex flex-col gap-1" style={{ listStyleType: 'disc', paddingLeft: 'var(--space-4)' }}>
                <li>Integrate the API using your Test Secret Key.</li>
                <li>Add webhooks to receive payments notifications.</li>
                <li>Apply for Live Mode to verify your payment destination.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Control Actions footer */}
        <div className={styles.footer}>
          {currentStep > 1 && currentStep !== 6 && (
            <Button variant="secondary" onClick={handleBack} disabled={loading}>
              Back
            </Button>
          )}

          <div style={{ marginLeft: 'auto' }}>
            {currentStep < 5 && (
              <Button onClick={handleNext}>Continue</Button>
            )}

            {currentStep === 5 && (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Initializing...' : 'Generate API Keys'}
              </Button>
            )}

            {currentStep === 6 && (
              <Button onClick={() => setCurrentStep(7)}>I have copied my keys</Button>
            )}

            {currentStep === 7 && (
              <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
