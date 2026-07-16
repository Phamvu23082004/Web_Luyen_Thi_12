# 05 — Security Baseline

## Principle

Security is not a feature — it's a property of all code. Every developer is responsible for writing secure code. The baseline defines the minimum security posture that every project must meet.

## OWASP Top 10 — Our Stance

| Risk | Our Default Mitigation |
|------|----------------------|
| Injection (SQL, NoSQL, OS) | Use parameterized queries via ORM or prepared statements. Never construct queries from user input strings. |
| Broken Authentication | Follow auth standards below. Use established libraries, never roll your own crypto. |
| Sensitive Data Exposure | Encrypt at rest and in transit. Never log secrets, tokens, or passwords. |
| XML External Entities | Don't parse XML from untrusted sources. If required, disable external entity resolution. |
| Broken Access Control | Enforce RBAC at the middleware/interceptor level. Default deny — explicitly grant access. |
| Security Misconfiguration | Apply security headers on all web responses. Disable debug/verbose errors in production. |
| Cross-Site Scripting (XSS) | Sanitize all user-generated content before rendering. Use framework-provided escaping by default. |
| Insecure Deserialization | Validate all incoming data with schemas before processing. Never trust client input. |
| Using Components with Known Vulnerabilities | Run dependency audit scans regularly. Update critical vulnerabilities within 1 week. |
| Insufficient Logging | Log security events (login, failed auth, permission denied). Never log sensitive data. |

## Authentication Standards

1. **Password hashing**: Use a slow, salted hashing algorithm (bcrypt, argon2, scrypt, or PBKDF2 with high iteration count). Never use MD5, SHA-1, or plain SHA-256 for passwords.
2. **Password policy**: Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number. Check against known breached passwords list where feasible.
3. **No forced rotation**: Follow NIST 800-63B — don't require periodic password changes unless there's evidence of compromise.
4. **Account lockout**: Lock after N failed attempts (project defines N, default: 5). Time-based unlock (15-30 min) + admin manual unlock.
5. **Token-based auth**: If using tokens (JWT, opaque tokens, etc.), keep payloads minimal. Use short-lived access tokens (15-30 min). Store refresh tokens securely (httpOnly cookies for web, secure storage for mobile).
6. **Session revocation**: Server-side session tracking. Ability to revoke all sessions for a user. Revocation check on every request.
7. **MFA**: Support when available (SSO providers, TOTP). Recommended for production SaaS and admin interfaces.

## Authorization Standards

1. **Default deny**: Routes/endpoints are protected unless explicitly marked as public.
2. **Role-based access control (RBAC)**: Enforce at the middleware/interceptor/filter level, not scattered in business logic.
3. **Field-level access**: Different roles may see different fields of the same resource. Implement response filtering per role.
4. **Resource ownership**: Users can only access their own data unless their role grants broader access.

## Data Protection

1. **Secrets**: Never in source code. Use environment variables or secret managers. Secret files (`.env`, `application-secret.yml`, etc.) are gitignored.
2. **Database credentials**: Different credentials per environment. No shared dev/prod credentials.
3. **Encryption in transit**: HTTPS/TLS everywhere. No exceptions, even for internal services.
4. **Encryption at rest**: Sensitive configuration (OAuth secrets, API keys) encrypted in the database or secret manager.
5. **PII handling**: Log user IDs, never email addresses or names. Audit logs capture actor ID, not actor details.
6. **Backup**: Database backups encrypted. Backup credentials stored separately from the backup.

## Input Validation

1. **Validate at the boundary**: All external input (HTTP requests, file uploads, webhooks) validated with schemas or type-safe validators before processing.
2. **Reject, don't sanitize**: Prefer rejecting invalid input over attempting to clean it. Exception: HTML sanitization for rich text fields.
3. **Type safety**: Be explicit about types. Use the language's type system and validation libraries to enforce input contracts.
4. **File uploads**: Validate MIME type, file size, and file extension. Store outside the web root. Serve through a separate endpoint with Content-Disposition.

## HTTP Security Headers

Every web-facing project must set these response headers (via framework middleware or reverse proxy):

| Header | Value | Purpose |
|--------|-------|---------|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | Force HTTPS |
| X-Content-Type-Options | `nosniff` | Prevent MIME type sniffing |
| X-Frame-Options | `DENY` | Prevent clickjacking |
| Content-Security-Policy | Project-specific | Prevent XSS, restrict resource loading |
| Referrer-Policy | `strict-origin-when-cross-origin` | Limit referrer information |

Implementation varies by stack — use your framework's built-in security middleware or a reverse proxy (Nginx, Caddy) to apply headers. Document the chosen approach in Tier 2.

## CORS (Web APIs)

1. **Never** allow wildcard origin (`*`) with credentials
2. **Whitelist-based**: Explicitly list allowed origins
3. **Default**: Same-origin only. Add cross-origin support when needed (mobile apps, external APIs).

## Rate Limiting

Every public-facing API must have rate limiting:
- **Global**: 100-200 requests/minute per IP
- **Auth endpoints**: 5-10 requests/minute per IP (stricter)
- **Sensitive operations**: Project-specific limits

Implement at the application level, reverse proxy level, or both. Document the chosen approach in Tier 2.

## Dependency Security

1. Run dependency audit scans regularly (at minimum monthly, ideally in CI). Every ecosystem has tools for this:
   - Node.js: `npm audit`, `pnpm audit`
   - Python: `pip-audit`, `safety`
   - Java/Kotlin: OWASP Dependency-Check, Snyk
   - .NET: `dotnet list package --vulnerable`
   - Go: `govulncheck`
2. Review and address critical/high vulnerabilities within 1 week
3. Update dependencies monthly (minor/patch). Major updates require planning.
4. Prefer well-maintained, widely-used packages. Avoid packages with no updates in 12+ months.

## Security Review Triggers

These changes require a security-focused code review:
- Any change to authentication or authorization logic
- New API endpoints that expose data
- Changes to input validation or sanitization
- Database schema changes involving user data
- Changes to CORS, CSP, or security header configuration
- Addition of new dependencies
