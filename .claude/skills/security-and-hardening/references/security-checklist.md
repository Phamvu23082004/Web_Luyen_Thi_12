# Security Checklist

Quick reference for web application security. Use alongside the `security-and-hardening` skill.

## Table of Contents

- [Threat Modeling (Start Here)](#threat-modeling-start-here)
- [Pre-Commit Checks](#pre-commit-checks)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Input Validation](#input-validation)
- [Rate Limiting & Abuse Prevention](#rate-limiting--abuse-prevention)
- [CSRF Protection](#csrf-protection)
- [Security Headers](#security-headers)
- [CORS Configuration](#cors-configuration)
- [Data Protection](#data-protection)
- [Secret Management](#secret-management)
- [Dependency Security](#dependency-security)
- [AI / LLM Security](#ai--llm-security)
- [Error Handling](#error-handling)
- [Security Response Protocol](#security-response-protocol)
- [OWASP Top 10 Quick Reference](#owasp-top-10-quick-reference)
- [OWASP Top 10 for LLMs Quick Reference](#owasp-top-10-for-llms-quick-reference)

## Threat Modeling (Start Here)

Before reaching for controls, spend five minutes thinking like an attacker:

- [ ] Trust boundaries mapped (requests, uploads, webhooks, third-party APIs, LLM output)
- [ ] Assets named (credentials, PII, payment data, admin actions, money movement)
- [ ] STRIDE run per boundary (Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation)
- [ ] Abuse cases written next to use cases ("how would I misuse this?")

## Pre-Commit Checks

- [ ] No secrets in code (`git diff --cached | grep -i "password\|secret\|api_key\|token"`)
- [ ] `.gitignore` covers: `.env`, `.env.local`, `*.pem`, `*.key`
- [ ] `.env.example` uses placeholder values (not real secrets)

## Authentication

- [ ] Passwords hashed with bcrypt (≥12 rounds), scrypt, or argon2
- [ ] Session cookies: `httpOnly`, `secure`, `sameSite: 'lax'`
- [ ] Session expiration configured (reasonable max-age)
- [ ] Rate limiting on login endpoint (≤10 attempts per 15 minutes)
- [ ] Password reset tokens: time-limited (≤1 hour), single-use
- [ ] Account lockout after repeated failures (optional, with notification)
- [ ] MFA supported for sensitive operations (optional but recommended)

## Authorization

- [ ] Every protected endpoint checks authentication
- [ ] Every resource access checks ownership/role (prevents IDOR)
- [ ] Admin endpoints require admin role verification
- [ ] API keys scoped to minimum necessary permissions
- [ ] JWT tokens validated (signature, expiration, issuer)

## Input Validation

- [ ] All user input validated at system boundaries (API routes, form handlers)
- [ ] Validation uses allowlists (not denylists)
- [ ] String lengths constrained (min/max)
- [ ] Numeric ranges validated
- [ ] Email, URL, and date formats validated with proper libraries
- [ ] File uploads: type restricted, size limited, content verified
- [ ] SQL queries parameterized (no string concatenation)
- [ ] HTML output encoded (use framework auto-escaping)
- [ ] URLs validated before redirect (prevent open redirect)
- [ ] Server-side URL fetches allowlisted; private/reserved IPs blocked (prevent SSRF)

## Rate Limiting & Abuse Prevention

Login isn't the only endpoint worth protecting — any unauthenticated, expensive, or state-changing route can be abused.

- [ ] Rate limits on all public endpoints (not just login) — tighter on auth, password reset, and anything that sends email/SMS
- [ ] Expensive operations (search, report generation, LLM calls, file processing) throttled per user/IP
- [ ] Limits keyed on something the caller can't trivially rotate (authenticated user ID where possible, not just IP)
- [ ] Limit responses use `429` with a `Retry-After` header; the limiter fails closed if its backing store is down
- [ ] Write/mutation endpoints have stricter limits than reads

## CSRF Protection

Relevant for any cookie/session-authenticated, state-changing request. Token-auth APIs (`Authorization: Bearer`) called from non-browser clients are not CSRF targets, but a cookie-based session is.

- [ ] State-changing routes require a CSRF token (synchronizer token or double-submit cookie) **or** rely on `SameSite` cookies plus an origin/referer check
- [ ] Session cookies set `SameSite=Lax` (or `Strict` for high-value flows) — see Authentication
- [ ] `GET` requests never mutate state (so they can't be triggered cross-site via image/link)
- [ ] CORS is not used as a CSRF defense — a permissive CORS policy does not stop a form POST

## Security Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (disabled, rely on CSP)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## CORS Configuration

```typescript
// Restrictive (recommended)
cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// NEVER use in production:
cors({ origin: '*' })  // Allows any origin
```

## Data Protection

- [ ] Sensitive fields excluded from API responses (`passwordHash`, `resetToken`, etc.)
- [ ] Sensitive data not logged (passwords, tokens, full CC numbers)
- [ ] PII encrypted at rest (if required by regulation)
- [ ] HTTPS for all external communication
- [ ] Database backups encrypted

## Secret Management

Secrets in source control are the highest-frequency real incident — they leak through commits, logs, and error payloads, and the fix is never just "delete the line" (git history keeps it).

- [ ] No secret hardcoded in source — API keys, passwords, tokens, connection strings all come from environment variables or a secret manager (Vault, AWS/GCP Secrets Manager, etc.)
- [ ] Required secrets validated at startup — the app fails fast with a clear message if one is missing, rather than crashing deep in a request path
- [ ] Secrets never logged or returned in error responses (see Error Handling)
- [ ] A secret that *may* have been exposed is treated as exposed: **rotate it**. Removing it from the latest commit does not undo the leak — it's still in history and any clone/CI cache.
- [ ] Rotation path exists and is known *before* an incident (how to issue a new key, where it's stored, what redeploys)

## Dependency Security

```bash
# Audit dependencies
npm audit

# Fix automatically where possible
npm audit fix

# Check for critical vulnerabilities
npm audit --audit-level=critical

# Keep dependencies updated
npx npm-check-updates
```

**Supply-chain hygiene** (`npm audit` won't catch malicious packages):
- [ ] Lockfile committed; CI installs with `npm ci` (not `npm install`)
- [ ] New dependencies reviewed (maintenance, downloads, `postinstall` scripts)
- [ ] No typosquats (`cross-env` vs `crossenv`, `react-dom` vs `reactdom`)

## AI / LLM Security

For any feature that calls an LLM (chatbots, summarizers, agents, RAG):

- [ ] Model output treated as untrusted — never into `eval`/SQL/shell/`innerHTML`/file paths
- [ ] Prompt injection assumed; permissions enforced in code, not in the system prompt
- [ ] Secrets, cross-tenant data, and full system prompts kept out of the context window
- [ ] Tool/agent permissions scoped; destructive or irreversible actions require confirmation
- [ ] Token, rate, and recursion/loop limits set (bound consumption)

## Error Handling

```typescript
// Production: generic error, no internals
res.status(500).json({
  error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
});

// NEVER in production:
res.status(500).json({
  error: err.message,
  stack: err.stack,         // Exposes internals
  query: err.sql,           // Exposes database details
});
```

## Security Response Protocol

When a review turns up a *live* vulnerability (not a hypothetical) — an exposed secret, an exploitable injection, a missing auth check on a real endpoint — switch from "leave a comment" mode to incident mode. A security finding is not just another `patch` bucket item; shipping anything on top of it widens the exposure window.

1. **Stop.** Don't keep layering changes on top of a known-exploitable state. The vulnerability is the priority.
2. **Escalate to a focused security review.** Pull in whoever owns security review (a security-reviewer agent/person, or a dedicated adversarial pass) rather than self-clearing it — the reviewer who found it is often too close to judge severity.
3. **Fix CRITICAL before continuing.** Data loss, auth bypass, RCE, and exposed credentials block everything else. Lower-severity findings can follow the normal triage buckets.
4. **Rotate any exposed secret.** See Secret Management — assume exposure means compromise.
5. **Sweep for the same class.** One SQL string-concat usually means there are others. One missing ownership check means the pattern was copied. Grep the codebase for the same shape before closing it out — fixing the single instance leaves the door open.

## OWASP Top 10 Quick Reference

| # | Vulnerability | Prevention |
|---|---|---|
| 1 | Broken Access Control | Auth checks on every endpoint, ownership verification |
| 2 | Cryptographic Failures | HTTPS, strong hashing, no secrets in code |
| 3 | Injection | Parameterized queries, input validation |
| 4 | Insecure Design | Threat modeling, spec-driven development |
| 5 | Security Misconfiguration | Security headers, minimal permissions, audit deps |
| 6 | Vulnerable Components | `npm audit`, keep deps updated, minimal deps |
| 7 | Auth Failures | Strong passwords, rate limiting, session management |
| 8 | Data Integrity Failures | Verify updates/dependencies, signed artifacts |
| 9 | Logging Failures | Log security events, don't log secrets |
| 10 | SSRF | Validate/allowlist URLs, restrict outbound requests |

## OWASP Top 10 for LLMs Quick Reference

For apps with LLM features. See the [OWASP GenAI Security Project](https://genai.owasp.org/llm-top-10/).

| ID | Risk | Prevention |
|---|---|---|
| LLM01 | Prompt Injection | Don't trust the system prompt as a boundary; enforce permissions in code |
| LLM02 | Sensitive Information Disclosure | Keep secrets/PII out of prompts; filter outputs |
| LLM03 | Supply Chain | Vet models, datasets, and plugins like any dependency |
| LLM04 | Data and Model Poisoning | Use trusted model sources, verify integrity; vet fine-tuning and RAG data |
| LLM05 | Improper Output Handling | Treat model output as untrusted; validate, parameterize, encode |
| LLM06 | Excessive Agency | Scope tool permissions; confirm destructive actions |
| LLM07 | System Prompt Leakage | Assume the system prompt can leak; put no secrets in it |
| LLM08 | Vector and Embedding Weaknesses | Partition RAG embeddings per tenant; validate documents before indexing |
| LLM09 | Misinformation | Ground answers with citations; validate critical claims; keep a human in the loop |
| LLM10 | Unbounded Consumption | Cap tokens, request rate, and loop/recursion depth |
