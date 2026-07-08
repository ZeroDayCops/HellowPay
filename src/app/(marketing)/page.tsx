import Link from 'next/link';
import Image from 'next/image';
import { Show, UserButton } from '@clerk/nextjs';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      {/* ---- Navigation ---- */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/logo.png"
              alt="HollowPay"
              width={32}
              height={32}
              className={styles.logoImage}
            />
            <span className={styles.logoText}>HollowPay</span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="/docs" className={styles.navLink}>Docs</Link>
            <Show when="signed-out">
              <Link href="/sign-in" className={styles.navLink}>Sign In</Link>
              <Link href="/sign-up" className={`btn btn-primary ${styles.navCta}`}>
                Start Building
              </Link>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* ---- Hero Section ---- */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          {/* Brand decomposition */}
          <div className={styles.brandReveal}>
            <div className={styles.brandParts}>
              <div className={styles.brandPart}>
                <span className={styles.brandLetter}>HOLL</span>
                <span className={styles.brandMeaning}>Zero HollowPay platform fee</span>
              </div>
              <div className={styles.brandPart}>
                <span className={styles.brandLetter}>LOW</span>
                <span className={styles.brandMeaning}>Low-friction payment experience</span>
              </div>
              <div className={styles.brandPart}>
                <span className={styles.brandLetter}>PAY</span>
                <span className={styles.brandMeaning}>Payments made simple</span>
              </div>
            </div>
          </div>

          <h1 className={styles.heroHeadline}>
            Our fee? <span className={styles.heroAccent}>Hollow.</span>
          </h1>
          <p className={styles.heroSubheadline}>
            Create beautiful payment experiences, integrate with a simple API,
            and automate what happens around every payment.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/sign-up" className="btn btn-primary btn-lg">
              Start Building
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              Read the Docs
            </Link>
          </div>
        </div>
      </section>

      {/* ---- How It Works ---- */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className="section-eyebrow">How It Works</span>
          <h2 className="section-headline mt-3">Direct to your payment destination</h2>
          <p className="body-lg mt-4" style={{ maxWidth: '640px' }}>
            HollowPay orchestrates the payment experience. The money goes
            directly from your customer to your own UPI payment destination.
          </p>

          <div className={styles.journeyFlow}>
            <div className={styles.journeyNode}>
              <div className={styles.journeyIcon}>🌐</div>
              <div className={styles.journeyLabel}>Your Website</div>
            </div>
            <div className={styles.journeyArrow}>
              <span className={styles.journeyArrowLabel}>API</span>
            </div>
            <div className={styles.journeyNodePrimary}>
              <div className={styles.journeyIcon}>
                <span className="hollow-ring hollow-ring-sm" />
              </div>
              <div className={styles.journeyLabel}>HollowPay</div>
            </div>
            <div className={styles.journeyArrow}>
              <span className={styles.journeyArrowLabel}>Direct</span>
            </div>
            <div className={styles.journeyNode}>
              <div className={styles.journeyIcon}>💰</div>
              <div className={styles.journeyLabel}>Your UPI</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className={styles.section} style={{ background: 'var(--surface)' }}>
        <div className={styles.sectionInner}>
          <span className="section-eyebrow">Built for Developers</span>
          <h2 className="section-headline mt-3">One API. One checkout. Zero platform fee.</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>◎</div>
              <h3 className="h4">Hosted Checkout</h3>
              <p className="body-sm mt-2">
                Beautiful, mobile-first checkout. UPI QR and direct app opening.
                No frontend code required.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⟨/⟩</div>
              <h3 className="h4">REST API</h3>
              <p className="body-sm mt-2">
                Create orders, manage checkout sessions, and receive signed
                webhooks. One API for everything.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🧪</div>
              <h3 className="h4">Test Mode</h3>
              <p className="body-sm mt-2">
                Full simulation environment. Test every payment flow — confirmed,
                pending, rejected, timeout — without real money.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔐</div>
              <h3 className="h4">Signed Webhooks</h3>
              <p className="body-sm mt-2">
                HMAC-signed webhook payloads with delivery tracking, automatic
                retries, and response logging.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📄</div>
              <h3 className="h4">Payment Pages</h3>
              <p className="body-sm mt-2">
                Accept payments without writing code. Create, publish, and
                share payment pages in minutes.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>₹0</div>
              <h3 className="h4">Zero Platform Fee</h3>
              <p className="body-sm mt-2">
                No setup fee. No monthly fee. No HollowPay platform fee.
                You only pay your underlying payment infrastructure costs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Pricing ---- */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className="section-eyebrow">Pricing</span>
          <h2 className="section-headline mt-3">Transparent. Simple. Hollow.</h2>

          <div className={styles.pricingCard}>
            <div className={styles.pricingAmount}>
              <span className="fee-zero" style={{ fontSize: '3rem' }}>₹0</span>
            </div>
            <div className={styles.pricingDetails}>
              <div className={styles.pricingLine}>₹0 HollowPay setup fee</div>
              <div className={styles.pricingLine}>₹0 HollowPay monthly fee</div>
              <div className={styles.pricingLine}>₹0 HollowPay platform fee</div>
            </div>
            <p className="caption mt-4">
              Underlying banking, UPI, payment infrastructure, or provider charges
              may apply where applicable.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Developer Experience ---- */}
      <section className={styles.section} style={{ background: 'var(--surface)' }}>
        <div className={styles.sectionInner}>
          <span className="section-eyebrow">Developer Experience</span>
          <h2 className="section-headline mt-3">Ship in minutes</h2>

          <div className={styles.codeBlock}>
            <div className={styles.codeHeader}>
              <span className={styles.codeDot} style={{ background: '#FF5F57' }} />
              <span className={styles.codeDot} style={{ background: '#FEBC2E' }} />
              <span className={styles.codeDot} style={{ background: '#28C840' }} />
              <span className={styles.codeTitle}>Create an Order — cURL</span>
            </div>
            <pre className={styles.codeContent}>{`curl -X POST https://hollowpay.zerodaycops.in/api/v1/orders \\
  -H "Authorization: Bearer hp_test_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "currency": "INR",
    "description": "Pro Speed Plan",
    "customer": {
      "name": "Customer Name",
      "email": "customer@example.com",
      "phone": "+919876543210"
    }
  }'`}</pre>
          </div>
        </div>
      </section>

      {/* ---- Security ---- */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className="section-eyebrow">Security</span>
          <h2 className="section-headline mt-3">Honest by design</h2>
          <p className="body-lg mt-4" style={{ maxWidth: '640px' }}>
            HollowPay never marks a payment as confirmed based on customer
            action alone. Merchants independently verify and confirm every
            payment. No fake trust badges. No misleading status messages.
          </p>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className={styles.ctaSection}>
        <div className={styles.sectionInner}>
          <h2 className="section-headline" style={{ color: 'var(--primary-foreground)' }}>
            Ready to build?
          </h2>
          <p className="body-lg mt-3" style={{ color: 'rgba(251, 250, 248, 0.8)', maxWidth: '480px' }}>
            Create your account, copy your test API key, and create your first
            order in minutes.
          </p>
          <div className={styles.heroCtas} style={{ marginTop: 'var(--space-6)' }}>
            <Link href="/sign-up" className="btn btn-lg" style={{
              background: 'var(--primary-foreground)',
              color: 'var(--primary)',
              fontWeight: 'var(--font-semibold)',
            }}>
              Start Building — It&apos;s Free
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image
              src="/logo.png"
              alt="HollowPay"
              width={24}
              height={24}
            />
            <span className={styles.footerBrandText}>HollowPay</span>
            <span className="caption">by ZeroDayCops</span>
          </div>
          <div className={styles.footerLinks}>
            <Link href="/docs" className={styles.footerLink}>Documentation</Link>
            <Link href="/sign-up" className={styles.footerLink}>Get Started</Link>
            <a href="https://github.com/ZeroDayCops/HollowPay" className={styles.footerLink} target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          <p className="caption mt-4">
            © {new Date().getFullYear()} ZeroDayCops. Payment experiences without the platform fee.
          </p>
        </div>
      </footer>
    </div>
  );
}
