# Contributing to HollowPay

Thank you for your interest in contributing to HollowPay! This guide will help you get started.

## Code of Conduct

Be respectful, professional, and constructive. We're building financial software — precision and honesty matter.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Run tests and linting
6. Commit with clear, descriptive messages
7. Push to your fork
8. Open a Pull Request

## Development Standards

### TypeScript

- Strict mode is enabled and enforced
- No `any` types without explicit justification
- All functions should have explicit return types for public APIs

### Code Style

- Use ESLint configuration as provided
- No hardcoded secrets or credentials
- No floating-point numbers for financial calculations
- All monetary amounts in minor units (paise for INR)

### Database

- All schema changes must use Drizzle migrations
- No raw SQL with string interpolation
- All queries must include tenant isolation filters

### Security

- Never expose internal database IDs
- All API endpoints must verify authentication and authorization
- No secrets in client-side bundles
- All state transitions must go through domain services

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add webhook HMAC signature verification
fix: prevent duplicate payment confirmation race condition
docs: update API authentication guide
refactor: extract payment state machine to domain layer
```

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include expected vs actual behavior
- Never include real credentials, customer data, or payment information in issues

## Pull Request Process

1. Ensure your PR addresses a specific issue or feature
2. Include a clear description of changes
3. Ensure all tests pass
4. Ensure TypeScript compiles without errors
5. Ensure linting passes
6. Request review from maintainers

## Financial Code Guidelines

If your contribution touches payment logic:

- **Never** mark a payment as confirmed based on customer action alone
- **Never** use floating-point for money
- **Always** go through the centralized state machine for status transitions
- **Always** use database transactions for financial state changes
- **Always** create audit log entries for sensitive operations

## Questions?

Open a GitHub Discussion or reach out to the maintainers.
