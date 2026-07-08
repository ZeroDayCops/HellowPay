# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in HollowPay, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

Email: **zerodaycops@gmail.com**

Subject: `[SECURITY] HollowPay — Brief description`

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity

### Scope

The following are in scope:

- Authentication bypass
- Authorization failures (IDOR, role escalation)
- Payment amount or destination tampering
- API key leakage or enumeration
- Webhook signature bypass
- SSRF via webhook URLs
- SQL injection
- XSS
- CSRF
- Open redirect
- Payment state machine bypass
- Duplicate confirmation race conditions
- File upload vulnerabilities
- Secret exposure in client bundles or logs

### Out of Scope

- Denial of Service (DoS) attacks
- Social engineering
- Physical access attacks
- Issues in third-party services (Clerk, Neon, Cloudflare)

### Disclosure

We will coordinate disclosure timing with you. We aim to fix critical vulnerabilities before any public disclosure.

## Security Design Principles

HollowPay follows these security principles:

1. **Server-authoritative**: All critical data (amounts, destinations, currencies) comes from server records, never from browser input
2. **Tenant isolation**: Every query includes workspace/project filters
3. **Least privilege**: API keys have scoped permissions
4. **Defense in depth**: Multiple layers of validation and authorization
5. **Audit everything**: All sensitive actions create immutable audit logs
6. **No secrets in code**: All credentials via environment variables, never in source code

## Responsible Disclosure

We appreciate security researchers who follow responsible disclosure practices. We will credit researchers (with permission) in our security acknowledgments.
