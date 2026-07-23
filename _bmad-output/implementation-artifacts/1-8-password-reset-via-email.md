---
baseline_commit: 6c67d07
---

# Story 1.8: Password reset via email

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to reset a forgotten password and receive a real email,
so that I can regain access on my own. *(FR-3, AUTH-03)*

## Acceptance Criteria

1. **Reset request for a registered email issues a time-limited, single-use token and delivers it by a real transactional email provider.** Given `POST /api/auth/forgot-password` with a registered email, when it is submitted, then a single-use reset token is created with an expiry (`PASSWORD_RESET_TOKEN_TTL_MINUTES`, default 30 min) and a reset link containing that token is sent via a **real transactional email provider (Resend)** behind a **provider-agnostic `EmailSender` interface**, with the provider API key read from **backend env only** (`EMAIL_PROVIDER_API_KEY`) — never committed, never exposed to the frontend. [Source: epics.md#Story 1.8 AC1; ARCHITECTURE-SPINE.md#AD-17 "password reset uses a separate short-lived token"]
2. **Reset request for an unknown email reveals nothing.** Given `POST /api/auth/forgot-password` with an email that has no matching account, when it is submitted, then the response has the **identical shape, status, and generic message** as a known-email request — no error, no "account not found," and no observable behavior difference (no token created, no email sent, but the caller cannot tell). [Source: epics.md#Story 1.8 AC2]
3. **A used or expired reset token is rejected; a valid token sets a new hashed password.** Given `POST /api/auth/reset-password` with `{ token, newPassword }`, when the token is unknown, already used, or past its expiry, then the request is rejected with a generic error (no distinction shown to the client between the three causes); when the token is valid and unused, then the user's `password_hash` is updated (bcrypt, same cost as login/seed) and the token is marked used **atomically** so it cannot be replayed. [Source: epics.md#Story 1.8 AC3; ARCHITECTURE-SPINE.md#AD-10 "passwords stored hashed"]

## Tasks / Subtasks

- [x] **Task 1 — Prisma schema: `PasswordResetToken`** (AC: 1, 3)
  - [x] Add to [schema.prisma](../../backend/src/prisma/schema.prisma), owned by `auth` (AD-05 — same owner as `users`):
    ```prisma
    model PasswordResetToken {
      id        String    @id @default(cuid())
      userId    String    @map("user_id")
      tokenHash String    @unique @map("token_hash")
      expiresAt DateTime  @map("expires_at")
      usedAt    DateTime? @map("used_at")
      createdAt DateTime  @default(now()) @map("created_at")

      user User @relation(fields: [userId], references: [id])

      @@index([userId])
      @@map("password_reset_tokens")
    }
    ```
  - [x] Add the back-relation `passwordResetTokens PasswordResetToken[]` to `User` in the same file.
  - [x] Store only `tokenHash` (SHA-256 of the raw token, hex) — **never** the raw token — mirroring `hashRefreshToken()` in [auth.service.ts](../../backend/src/modules/auth/auth.service.ts#L28-L30). The raw token exists only in the email link and the incoming request body.
  - [x] Run `npx prisma migrate dev --name password_reset_tokens` (Node 24 via `fnm` — [[prisma7-dev-env-gotchas]]), then a standalone `npx prisma generate` if the generated client comes out incomplete (known gotcha). Verify `tsc`/`nest build` sees `prisma.passwordResetToken`.

- [x] **Task 2 — Config + env documentation** (AC: 1)
  - [x] Add three variables to the repo-root `.env.example` (the one documented env file — see Story 1.7's note that `backend/.env.example` does not exist), each with a one-line comment:
    - `EMAIL_FROM_ADDRESS=onboarding@resend.dev` — Resend's shared test sender; **without a verified custom domain, Resend only delivers to the account's own registered email** — document this limitation inline for whoever runs the manual smoke test.
    - `PASSWORD_RESET_TOKEN_TTL_MINUTES=30` — reset-link validity window.
    - `FRONTEND_BASE_URL=http://localhost:5173` — used to build the reset link (`${FRONTEND_BASE_URL}/reset-password?token=...`); becomes the real domain in Epic 6 production.
  - [x] `EMAIL_PROVIDER_API_KEY` **already exists** in `.env.example` (added by Story 1.1's scaffold AC) — do not duplicate it, just start actually reading it.
  - [x] Read all via `ConfigService.get<string>(...)`, never `process.env` directly (matches every prior story's convention).

- [x] **Task 3 — `EmailSender` interface + Resend implementation** (AC: 1)
  - [x] `backend/src/common/email/email-sender.ts`: export an injection token `export const EMAIL_SENDER = Symbol('EMAIL_SENDER')` and an interface `EmailSender { sendPasswordResetEmail(to: string, resetLink: string): Promise<void> }`. Lives in `common/` (cross-cutting, like `RedisService`) — the interface itself is what makes the provider swappable (the epics AC's literal words: "provider-agnostic email interface"), not the DI mechanics.
  - [x] `backend/src/common/email/resend-email-sender.service.ts`: `@Injectable()` implementing `EmailSender`, calling Resend's REST API directly via the **global `fetch`** (Node 24 has it built in) — **do not add the `resend` npm package as a new dependency**; a single `POST https://api.resend.com/emails` with `Authorization: Bearer <EMAIL_PROVIDER_API_KEY>` (read via `ConfigService.get('EMAIL_PROVIDER_API_KEY')`) and a JSON body `{ from: config.get('EMAIL_FROM_ADDRESS'), to, subject: 'Đặt lại mật khẩu OnThi12', html }` (the `html` embeds `resetLink` as a clickable anchor + the raw URL as plain text fallback) is the entire integration, matching the "no new dependency" precedent set by Story 1.7 (hand-rolled over library). Throw (a plain `Error`, caught by the caller — see Task 4) on a non-2xx response; never log the API key or the raw email body's reset link (log only "password reset email dispatch failed for user <id>").
  - [x] Wire `{ provide: EMAIL_SENDER, useClass: ResendEmailSenderService }` into `AuthModule.providers` in [auth.module.ts](../../backend/src/modules/auth/auth.module.ts) (not a shared `EmailModule` — only `auth` uses it in this story; promote to its own module only if a second consumer appears later — avoid speculative structure).
  - [x] `backend/src/common/email/resend-email-sender.service.spec.ts` (unit): mock global `fetch` (`vi`/`jest.fn()` via `global.fetch = jest.fn()`), assert the request URL, `Authorization` header, and JSON body shape; assert it throws on a mocked non-2xx response.

- [x] **Task 4 — `AuthService.requestPasswordReset()`** (AC: 1, 2)
  - [x] Add to [auth.service.ts](../../backend/src/modules/auth/auth.service.ts), injecting `@Inject(EMAIL_SENDER) private readonly emailSender: EmailSender`:
    ```
    async requestPasswordReset(email: string): Promise<void>
    ```
  - [x] Look up `prisma.user.findUnique({ where: { email } })` (exact match — same non-normalized lookup as `validateUser`, do **not** introduce email lowercasing here since login doesn't do it either; that's a separate pre-existing inconsistency, out of scope for this story).
  - [x] If no user: **return normally, do nothing else** — no token row, no email call. The controller (Task 6) sends the identical response either way, so AC 2 holds at the HTTP layer regardless of what this method does internally.
  - [x] If a user is found: generate `token = randomBytes(32).toString('hex')` (`node:crypto`), compute `tokenHash = sha256(token)` hex (reuse the same `createHash('sha256')` pattern already in the file — extract or duplicate the two-line helper, do not import a new crypto library), `expiresAt = new Date(Date.now() + ttlMinutes * 60_000)`, `prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })`, build `resetLink = `${configService.get('FRONTEND_BASE_URL')}/reset-password?token=${token}``, then `await this.emailSender.sendPasswordResetEmail(user.email, resetLink)` **wrapped in try/catch** — on failure, log server-side (`Logger`) and swallow the error (do not throw to the controller — a Resend outage must not turn into a 500 that could be used to fingerprint "this email exists but sending failed" vs a generic 200 for unknown emails; it also must not block the generic-response contract of AC 2).

- [x] **Task 5 — `AuthService.resetPassword()`** (AC: 3)
  - [x] Add:
    ```
    async resetPassword(token: string, newPassword: string): Promise<void>
    ```
  - [x] Hash the incoming token the same way, `prisma.passwordResetToken.findUnique({ where: { tokenHash } })`. If not found, **or** `record.usedAt !== null`, **or** `record.expiresAt < new Date()` → throw `new UnprocessableEntityException('Invalid or expired reset token')` — **identical message for all three causes** (mirrors the identical-message pattern in `validateUser`, AC 3's "no distinction shown"). This is a **single-cause 422 — no `errorCode`** (AD-16; matches the precedent set by Story 1.7's 429, and 1.5/1.6's single-cause 401/403 — `error-codes.ts` stays empty; this story does not add to it).
  - [x] If valid: within a single `prisma.$transaction([...])` (first multi-write transaction in the codebase — mirrors the *intent* of AD-12's "single transaction" pattern even though this isn't the submission path): (a) update the user's `passwordHash` with `bcrypt.hash(newPassword, 10)` (same cost as login/seed — [[prisma7-dev-env-gotchas]]), (b) set `passwordResetToken.usedAt = new Date()` on that token row. Doing both in one transaction closes the race where two concurrent requests with the same still-valid token could otherwise both pass the "not yet used" check and both write a password.
  - [x] After the transaction commits, revoke the user's active session: `await this.redis.client.del(refreshRedisKey(user.id))` (reuses the existing `logout()` helper's exact key — do **not** invent a new key scheme). Rationale: a password reset is exactly the moment a stale/possibly-compromised session should not silently continue; this is a two-line reuse of existing infrastructure, not new scope.

- [x] **Task 6 — DTOs + controller routes (`@Public()`, no rate limiting)** (AC: 1, 2, 3)
  - [x] `backend/src/modules/auth/dto/request-password-reset.dto.ts`: `RequestPasswordResetDto { @IsEmail() email!: string }`.
  - [x] `backend/src/modules/auth/dto/reset-password.dto.ts`: `ResetPasswordDto { @IsString() @IsNotEmpty() token!: string; @IsString() @MinLength(8) newPassword!: string }`. (No documented password-complexity policy exists elsewhere in the codebase — `@MinLength(8)` is this story's own floor, matching the seed password's length; flagged as an assumption, not a hidden decision — see Dev Notes.)
  - [x] In [auth.controller.ts](../../backend/src/modules/auth/auth.controller.ts), add two `@Public()` routes, **no** `@UseGuards(LoginRateLimitGuard)` on either (see Dev Notes — out of scope for AD-19, which names exactly two endpoints and neither is this one):
    ```
    @Public() @Post('forgot-password') @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: RequestPasswordResetDto): Promise<{ message: string }> {
      await this.authService.requestPasswordReset(dto.email);
      return { message: 'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi.' };
    }

    @Public() @Post('reset-password') @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
      await this.authService.resetPassword(dto.token, dto.newPassword);
      return { message: 'Mật khẩu đã được đặt lại thành công.' };
    }
    ```
  - [x] The literal returned message string is what makes AC 2 hold — it must be **identical** regardless of whether `requestPasswordReset` found a user, since the method itself never throws or returns a discriminating value.

- [x] **Task 7 — Backend tests** (AC: 1, 2, 3)
  - [x] `auth.service.spec.ts` additions (extend the existing `buildService()` helper with a `passwordResetToken: { create: jest.fn(), findUnique: jest.fn() }` on the mocked `prisma`, a mocked `emailSender: { sendPasswordResetEmail: jest.fn() }`, and `prisma.$transaction: jest.fn((ops) => Promise.all(ops))` or a callback-form mock matching whichever transaction API form Task 5 uses):
    - `requestPasswordReset`: known email → creates a token row with a **hashed** (not raw) `tokenHash` and calls `sendPasswordResetEmail` with a link containing the raw token; unknown email → neither `passwordResetToken.create` nor `sendPasswordResetEmail` is called; email-sender throwing does **not** propagate out of the method (caught + swallowed).
    - `resetPassword`: valid unused/unexpired token → updates `passwordHash` (assert `bcrypt.compare(newPassword, newHash)` resolves true) and sets `usedAt`, and deletes the Redis refresh-token key; unknown token → throws `UnprocessableEntityException`; already-used token (`usedAt` set) → throws the same; expired token (`expiresAt` in the past) → throws the same; assert all three throw **the identical message** (locks AC 3's "no distinction" requirement, same style as the `validateUser` identical-message test).
  - [x] `resend-email-sender.service.spec.ts` per Task 3.
  - [x] `backend/test/password-reset.e2e-spec.ts` (integration, mirror the no-real-infra pattern from [login-rate-limit.e2e-spec.ts](../../backend/test/login-rate-limit.e2e-spec.ts)): a `TestingModule` importing the real `AuthController` + `AuthService`, with `PrismaService` overridden by an **in-memory fake** (plain objects/Maps backing `user.findUnique`, `passwordResetToken.create/findUnique`, `$transaction`) and `EMAIL_SENDER` overridden by a fake recording calls — no running Postgres, no running Resend, exercised through the real global filter/envelope. Assert: forgot-password returns the same `{ data: { message } }` shape and HTTP 200 for both a seeded and an unseeded email; reset-password with a bogus token returns 422 with no `errorCode`; reset-password with a valid token returns 200 and the fake Prisma reflects the password-hash update + `usedAt`.
  - [x] Run the full backend suite (Node 24 via `fnm`) — prior suite (10 unit suites / 53 tests + 3 e2e suites / 15 tests) must stay green, plus the new specs. `npm run lint` and `npm run build` clean.

- [x] **Task 8 — Frontend: forgot/reset password pages + routing** (AC: 1, 2, 3; UX-DR14 fidelity to `docs/stitch_exports/Login`)
  - [x] `frontend/src/features/auth/forgot-password-page.tsx`: email input (reuse `Input`/`Button` from `components/ui/`, same visual language as [login-page.tsx](../../frontend/src/features/auth/login-page.tsx)) → on submit, `apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })`; on success (which is *every* non-network-error response, per AC 2) replace the form with a generic confirmation panel ("Nếu email tồn tại, một liên kết đặt lại mật khẩu đã được gửi." — must **not** say "email sent" in a way that implies existence); link back to `/login`.
  - [x] `frontend/src/features/auth/reset-password-page.tsx`: read `token` via `useSearchParams()` (react-router 7, already a dependency); form with `newPassword` + a confirm field, client-side check they match and meet `minLength(8)` before calling `apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) })`; on success show a confirmation + link to `/login`; on `ApiError` (422) show a generic "Liên kết không hợp lệ hoặc đã hết hạn" message with a link back to `/forgot-password` (never surface the raw backend message).
  - [x] In [login-page.tsx](../../frontend/src/features/auth/login-page.tsx), add the **"Quên mật khẩu?"** link (present in the `docs/stitch_exports/Login/code.html` mockup, deliberately omitted when the login page was first built — see that file's top comment: "forgot-password link... removed — none exist as features in this story/SRS." That statement is now false; wire it to `/forgot-password`.
  - [x] In [router.tsx](../../frontend/src/routes/router.tsx), add both routes at the **same top level as `/login`** (outside `RequireAuth`/`AppShell` — these are unauthenticated-only screens):
    ```
    { path: '/forgot-password', element: <ForgotPasswordPage /> },
    { path: '/reset-password', element: <ResetPasswordPage /> },
    ```
  - [x] `forgot-password-page.test.tsx` / `reset-password-page.test.tsx`: mirror [login-page.test.tsx](../../frontend/src/features/auth/login-page.test.tsx)'s pattern exactly — `vi.stubGlobal('fetch', ...)`, `MemoryRouter` wrapper (add an initial `?token=...` entry for the reset-page test), assert the generic confirmation text renders and the raw API message never does.

- [x] **Task 9 — Verify** (AC: 1, 2, 3)
  - [x] Backend: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build` — all green/clean (Node 24 via `fnm`).
  - [x] Frontend: `npm test` (Vitest), `npm run lint` (oxlint), `npm run build` — all green/clean.
  - [x] Manual smoke (documented honestly — see Story 1.5/1.6/1.7's honesty precedent): with a real `EMAIL_PROVIDER_API_KEY` (Resend), `curl -X POST /api/auth/forgot-password` for a seeded student email that matches **the Resend account's own registered address** (free-tier sender restriction — see Task 2), confirm the email arrives with a working link; `curl` the same for a non-existent email and confirm the HTTP response is byte-identical; follow the link's token through `reset-password` and confirm the new password logs in while the old one doesn't; replay the same token a second time and confirm 422. If no real Resend key is available in this environment, say so explicitly rather than claiming the live send was verified — automated tests already cover the logic end-to-end with a fake sender.

### Review Findings

_Adversarial code review, 2026-07-23 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 2 decision-needed (both resolved by Admin), 25 patch, 5 deferred, 3 dismissed as noise._

**Patch**

- [x] [Review][Patch] **AC 2 timing oracle — the known-email path awaits a live Resend round-trip** — `requestPasswordReset()` awaits `sendPasswordResetEmail()` (a real `POST https://api.resend.com/emails`) before the controller responds, so a known email costs a SELECT + INSERT + internet round-trip (~200–800 ms) while an unknown email returns after one indexed SELECT (single-digit ms). The bodies are byte-identical but the latency is not — a wordlist sorted by response time enumerates every registered account, which is what AC 2's "no observable behavior difference" forbids. The Dev Notes waived timing defense, but that reasoning only accounted for "an absent DB row and a skipped email call", not for the send being a synchronous network call; the same file already solves exactly this for login via `DUMMY_PASSWORD_HASH`. **Decided by Admin during the Story 1.8 code review (2026-07-23): fire-and-forget the send** (`void this.emailSender.sendPasswordResetEmail(...).catch(...)`) so both branches return in constant time — the failure is still logged server-side, just outside the request. Update the Dev Notes paragraph that waived this, since its reasoning no longer holds. [auth.service.ts:190-191]
- [x] [Review][Patch] **AC 3 violated: the used/expired check sits outside the transaction, so concurrent replay still succeeds** — `findUnique` + the `usedAt !== null` check happen in application code, then `$transaction` runs two *unconditional* writes. Two concurrent POSTs with the same still-valid token both pass the check and both commit; the second `bcrypt.hash` wins, so the account ends up with a password the first requester never sees. The JSDoc ("closing the race where two concurrent requests with the same still-valid token could otherwise both succeed") and the Completion Notes both assert a property the code does not have. The reset page has no in-flight guard, so a double-Enter is a realistic trigger. Fix: interactive `$transaction(async (tx) => …)` with a conditional `tx.passwordResetToken.updateMany({ where: { id, usedAt: null }, … })` and reject when `count === 0`. [backend/src/modules/auth/auth.service.ts:207-232]
- [x] [Review][Patch] **`PASSWORD_RESET_TOKEN_TTL_MINUTES` parsing: `??` only guards `undefined`** — an empty var (`PASSWORD_RESET_TOKEN_TTL_MINUTES=`) gives `Number('') === 0` → `expiresAt === now` → every reset link dead on arrival with no server-side signal; a non-numeric value gives `NaN` → `new Date(NaN)` → Prisma rejects → 500 *only for existing emails*, a second enumeration oracle. `getPositiveIntConfig()` in `login-rate-limit.guard.ts:29-42` was written for exactly this hazard (its comment explains that `ConfigService.get<number>` is a compile-time-only cast) and was not reused. [backend/src/modules/auth/auth.service.ts:179-182]
- [x] [Review][Patch] **`FRONTEND_BASE_URL` and `EMAIL_FROM_ADDRESS` are interpolated with no fallback and no boot validation** — `app.module.ts:22` calls `ConfigModule.forRoot` without a `validationSchema`, so an unset var yields the literal link `undefined/reset-password?token=…`, the email is sent anyway, the server logs nothing and returns 200. Same for `from: undefined` in the Resend body. Fix: fall back / fail fast at boot. [backend/src/modules/auth/auth.service.ts:188; backend/src/common/email/resend-email-sender.service.ts:28]
- [x] [Review][Patch] **`forgot-password-page.tsx` uses `try`/`finally` with no `catch`** — `apiFetch` throws `ApiError` on any non-2xx and rejects on network failure, so the rejection escapes `handleSubmit` into React's discarded onSubmit promise (unhandled rejection), and the `finally` still shows "liên kết đã được gửi" when the backend is down and nothing was sent. `login-page.tsx:41-49` uses an explicit `catch`; the inline comment ("every non-network-error response") describes behavior the code does not have. Keeping the generic message is correct for AC 2 — the fix is an explicit `catch` with a comment saying so. [frontend/src/features/auth/forgot-password-page.tsx:22-30]
- [x] [Review][Patch] **No timeout on the Resend `fetch`** — Node's global `fetch` has no default timeout. If `api.resend.com` accepts the connection and never responds, `requestPasswordReset` never returns and the HTTP request hangs until the client gives up, accumulating sockets and handles. NFR-11 requires exactly this class of handling for external dependencies. Fix: `signal: AbortSignal.timeout(5000)`. [backend/src/common/email/resend-email-sender.service.ts:21]
- [x] [Review][Patch] **Email-send failures are logged with zero diagnostic information** — the sender discards `res.status` and the response body and throws a bare `new Error('Failed to send password reset email')`; the caller does `catch {` *without binding the error* and logs only `password reset email dispatch failed for user <id>`. In production an invalid API key (401), an unverified sender domain (403), a quota trip (429) and a DNS failure are indistinguishable — and the Dev Agent Record confirms the live send was never verified, so this is precisely the diagnostic that will be needed first. PROJECT-STANDARDS §6 requires unexpected errors be logged with full context + stack. Include the status; still never the key or the reset link. [backend/src/modules/auth/auth.service.ts:192-199; backend/src/common/email/resend-email-sender.service.ts:35-39]
- [x] [Review][Patch] **The e2e spec never registers the global guards, so `@Public()` is not exercised** — the cited precedent `roles-guard.e2e-spec.ts:70-71` provides both `{ provide: APP_GUARD, useClass: JwtAuthGuard }` and `RolesGuard`, matching `app.module.ts:40-41`; this spec provides neither. If `@Public()` were dropped from either new route, every test here would still pass while production returned 401 to anonymous users — the exact regression an e2e for two anonymous-only endpoints exists to catch. [backend/test/password-reset.e2e-spec.ts:135-159]
- [x] [Review][Patch] **Both forgot-password frontend tests are non-discriminating, and one asserts a string the mock never returns** — the two tests differ only in the email typed in; the stubbed `fetch` is byte-identical and the page renders a module constant, never reading the response. The proof: the mock returns `'…hệ thống, liên kết đặt lại…'` while the assertion looks for `'…hệ thống, một liên kết đặt lại…'` — different strings, and the test still passes. The one labelled "(AC 2)" cannot fail for any implementation that renders a constant. Replace the duplicate with the failure-path test the `catch` fix needs, and fix the mock-string drift. [frontend/src/features/auth/forgot-password-page.test.tsx:19-71]
- [x] [Review][Patch] **`reset-password-page.tsx`: a missing `?token` shows the full form, and every failure reads as "link expired"** — `catch { setError(INVALID_TOKEN_ERROR) }` swallows the status, so a 500, a 400 from the DTO (what a missing token produces), and a dropped connection all render "Liên kết không hợp lệ hoặc đã hết hạn" plus a "request a new link" CTA — the user requests a new link, hits the same outage, and loops. `ApiError` carries `statusCode`; branch on 422 and show a generic retry message otherwise. Also detect the missing token up front rather than after two password fields are filled. [frontend/src/features/auth/reset-password-page.tsx:17, 44-45]
- [x] [Review][Patch] **The `$transaction` assertions in both test layers prove nothing** — both fakes are `$transaction: (ops) => Promise.all(ops)`, so the "operations" have already executed by the time `$transaction` receives them; `expect(ops).toHaveLength(2)` asserts array length, not atomicity. The e2e's "updates the password hash + usedAt" would pass identically if `$transaction` were deleted and the writes issued sequentially — the exact regression the transaction exists to prevent. No test anywhere fails if atomicity breaks. (Coupled to the concurrent-replay fix: switching to an interactive transaction requires rewriting these mocks anyway.) [backend/src/modules/auth/auth.service.spec.ts:166, 261-284; backend/test/password-reset.e2e-spec.ts:99]
- [x] [Review][Patch] **A successful reset leaves the user's other outstanding tokens valid** — `requestPasswordReset` issues a new token without touching prior ones, and `resetPassword` marks only the token that was used. Request a reset three times, use link #3, and links #1 and #2 each remain able to change the password for the rest of their TTL. Fix: add `updateMany({ where: { userId, usedAt: null }, data: { usedAt } })` to the same transaction. [backend/src/modules/auth/auth.service.ts:184-186, 223-232]
- [x] [Review][Patch] **A Redis failure after the transaction commits returns 500 for an already-successful reset** — the `redis.client.del` on line 236 is unguarded. If Redis is down, the password has already changed but the client gets a 500, which the frontend renders as "link invalid or expired" — the user requests a new link while their new password already works. Wrap in try/catch and log. [backend/src/modules/auth/auth.service.ts:236]
- [x] [Review][Patch] **Test coverage gaps on paths that exist in the code** — no e2e for an expired token (expiry is covered only by a unit test against a hand-built mock), no e2e for the 400 on a too-short password, no test where `fetch` *rejects* (DNS/ECONNRESET) in the email sender, no test with a missing/blank TTL or `FRONTEND_BASE_URL`, no test where `redis.client.del` rejects, no test where a `$transaction` leg rejects, and no frontend render without a `?token`. [backend/test/password-reset.e2e-spec.ts; backend/src/common/email/resend-email-sender.service.spec.ts; backend/src/modules/auth/auth.service.spec.ts; frontend/src/features/auth/reset-password-page.test.tsx]
- [x] [Review][Patch] **The backend's user-facing messages are dead code and have already drifted from the frontend copy** — both handlers return carefully worded Vietnamese strings; both pages hardcode their own and discard the payload. They already disagree ("liên kết đặt lại" vs "một liên kết đặt lại"). Nothing consumes the backend copy, so it will keep rotting; it is also inconsistent with the English messages elsewhere in the module. Pick one layer to own user-facing copy. [backend/src/modules/auth/auth.controller.ts:61-64, 74]
- [x] [Review][Patch] **The session-revocation comment overstates what happens** — "a stale/possibly-compromised session should not silently continue", but only the Redis refresh key is deleted; the stateless access token keeps authorizing requests for up to `JWT_EXPIRES_IN` (15 min) because `JwtAuthGuard` performs no revocation check. `logout()`'s comment at line 130 is honest about the same limitation; match it. (Real access-token revocation is deferred — see below.) [backend/src/modules/auth/auth.service.ts:234-236]
- [x] [Review][Patch] **No `@MaxLength(72)` on `newPassword` — bcrypt silently truncates** — bcrypt ignores everything past 72 bytes, which is ~24 Vietnamese characters in UTF-8. A user who picks a long passphrase gets a credential weaker than they believe, with no signal. (Login truncates identically, so nothing breaks — the password is just silently shorter than chosen.) [backend/src/modules/auth/dto/reset-password.dto.ts:8-10]
- [x] [Review][Patch] **`hashResetToken` is a byte-for-byte duplicate of `hashRefreshToken`, eight lines apart** — two names for one operation in one file invites the classic drift bug where someone hardens one and not the other. Task 5 permitted either extracting or duplicating; a single `sha256Hex(token)` is strictly simpler and matches CLAUDE.md §2. [backend/src/modules/auth/auth.service.ts:36-44]
- [x] [Review][Patch] **`jest.restoreAllMocks()` cannot undo a direct `global.fetch = fetchMock` assignment** — it only restores spies created via `jest.spyOn`, so the `afterEach` is dead code that reads as cleanup and the stub persists for the rest of the file. Harmless today only because both tests re-stub. Use `jest.spyOn(global, 'fetch')`. [backend/src/common/email/resend-email-sender.service.spec.ts]
- [x] [Review][Patch] **e2e helper throws an opaque `TypeError` instead of failing an assertion** — `const [, resetLink] = emailSender._calls[0] ? … : ['', '']` then `new URL(resetLink)`. If no email was captured — the exact regression this test exists to catch — the failure surfaces as `TypeError: Invalid URL` from a helper line rather than "expected sendPasswordResetEmail to have been called". Assert `_calls.length` first. [backend/test/password-reset.e2e-spec.ts:204-207]
- [x] [Review][Patch] **A successful reset does not clear tokens already in the browser's localStorage** — a user who resets while logged in on the same browser keeps stale tokens; the server-side refresh key is gone, so the next refresh 401s and leaves a broken session. [frontend/src/features/auth/reset-password-page.tsx:37-48]
- [x] [Review][Patch] **Stale controller header comment: "These three routes"** — there are now five; the diff added two routes directly beneath the comment without touching it. [backend/src/modules/auth/auth.controller.ts:17-21]
- [x] [Review][Patch] **`migration_lock.toml` carries an accidental LF→CRLF flip, and the File List omits two modified files** — the lock file's own header says not to edit it manually and the change is pure line-ending churn from running `prisma migrate dev` on Windows; it should be reverted before commit. Neither it nor `sprint-status.yaml` appears in the Dev Agent Record File List. [backend/src/prisma/migrations/migration_lock.toml]
- [x] [Review][Patch] **Dev Agent Record frontend test baseline is wrong** — "6 test files / 14 tests (up from 4/8)". The current figures are correct, but the pre-story baseline was 4 files / **9** tests, and the new specs add **5** tests, not 6. All backend counts verified accurate. Story records are reviewed for honesty every story. [1-8-password-reset-via-email.md:220]
- [x] [Review][Patch] **`docs/PROJECT-STANDARDS.md` §8 required-env table not updated** — `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM_ADDRESS`, `PASSWORD_RESET_TOKEN_TTL_MINUTES` and `FRONTEND_BASE_URL` are all load-bearing now (two of them fail unsafely, per the findings above) but the document the repo declares its single source of truth still lists only seven variables. A deployer following §8 ships a broken reset flow. [docs/PROJECT-STANDARDS.md §8]

**Deferred**

- [x] [Review][Defer] **No rate limit on `/auth/forgot-password`** — the spec's Scope guardrails explicitly forbid adding one (AD-19 names only login + AI-parse-enqueue), and the code correctly complies. But this is an unauthenticated endpoint that triggers third-party sends: a script POSTing one known address 10,000 times floods that inbox, inserts 10,000 token rows, and exhausts the Resend free-tier daily quota so *no* legitimate reset email can be delivered. SRS §9.6 scopes rate limiting to "endpoint nhạy cảm", which this arguably is. [auth.controller.ts:50-65] — deferred by Admin during the Story 1.8 code review (2026-07-23): keep this story inside its AD-19 guardrail and open a follow-up hardening story instead of widening scope silently.
- [x] [Review][Defer] **`password_reset_tokens` is never purged** — no expiry sweep and no cleanup path, so the table grows monotonically forever. [backend/src/modules/auth/auth.service.ts:184-186] — deferred: needs a scheduler, none exists in the stack yet.
- [x] [Review][Defer] **Email lookup is case-sensitive** — a user registered as `student1@onthi12.local` who types `Student1@…` gets no token, no email, and a confirmation screen telling them to check their inbox. [backend/src/modules/auth/auth.service.ts:172] — deferred, pre-existing: login has the identical behavior and Task 4 explicitly scoped normalization out of this story.
- [x] [Review][Defer] **The FK is `ON DELETE RESTRICT`** — combined with the no-purge finding, every user who has ever requested a reset becomes undeletable. [backend/src/prisma/schema.prisma:51] — deferred, pre-existing: consistent with every other relation in the schema, and no user-deletion feature exists yet.
- [x] [Review][Defer] **Both new pages call `apiFetch` inline instead of going through TanStack Query** — project-context.md mandates "TanStack Query hooks + a single API client in `lib/`"; `QueryClientProvider` is mounted and unused by any feature. [frontend/src/features/auth/] — deferred, pre-existing: matches the login-page precedent; the convention should either be followed repo-wide or amended, which is bigger than this story.

## Dev Notes

### Scope guardrails (read first)

- **No rate limiting on `forgot-password`/`reset-password`.** AD-19 names exactly two rate-limited endpoints — login (per IP + per account) and AI-parse-enqueue (per teacher, Story 2.1). Neither is this story. Do **not** wire `LoginRateLimitGuard` or build a new limiter here, even though email-bombing/enumeration-via-timing are real concerns for this kind of endpoint — that hardening is explicitly out of scope for the MVP per the architecture spine and would be scope creep. If Admin wants it, that's a follow-up story, not a silent addition here. [Source: ARCHITECTURE-SPINE.md#AD-19]
- **No new npm dependencies.** Resend is called via the global `fetch` (Node 24 has it natively) — do not add the `resend` SDK package or any email-templating library. This continues Story 1.7's precedent (hand-rolled Redis limiter over `@nestjs/throttler`) of preferring a few lines of first-party code over a new dependency for a simple, single-purpose integration.
- **This is the *first* multi-step Prisma transaction in the codebase.** Confirm the exact `prisma.$transaction` call shape (array-of-promises vs. interactive callback) against the actually-installed Prisma 7 client API before writing `resetPassword()` — don't assume the Prisma 5/6 API surface is identical; verify via `generated/prisma/client`'s types or the Prisma 7 docs at implementation time.
- **`error-codes.ts` stays empty.** The 422 in `resetPassword` is single-cause (all three failure reasons collapse into one message) — do not add an `errorCode`, do not touch `common/exceptions/error-codes.ts`. Same precedent as the 429 in Story 1.7 and the 401/403 in Stories 1.5/1.6.

### The load-bearing design decision: email-provider choice and why it's decided *now*

The Architecture Spine's `## Deferred` section lists *"Password-reset email provider (FR-3) — SMTP/provider choice open; a stub is acceptable for the evaluation (PRD Open Question 1)"* — written 2026-07-16. But `epics.md`'s Story 1.8 (same planning batch) is explicit: *"delivered by a real transactional email provider (e.g. Resend or Brevo free tier)"* — not a stub. **This story follows the epics.md text** (the more specific, story-level requirement) and picks **Resend** concretely, because:
- The AC can't be tested/demoed meaningfully against a stub ("receive a real email" is literally AC 1's wording).
- Resend's free tier (100/day, 3,000/month) comfortably covers capstone-scale demo traffic (NFR-09 cost constraint).
- Its REST API is a single `POST` call — no SDK, no SMTP client library, minimal surface (see Task 3).
- The `EmailSender` interface (Task 3) is what actually satisfies "provider-agnostic" — swapping to Brevo or anything else later touches only `resend-email-sender.service.ts`, never `AuthService` or the controller.

**Flag for Admin:** this resolves the architecture spine's "Deferred" note in favor of the epics.md text. If a stub was actually intended (e.g. no real Resend account available for grading), say so and this story's Task 3/6 collapse to a console-log stub implementing the same `EmailSender` interface — the interface boundary makes that a one-file swap either way.

### Previous story intelligence (Stories 1.5–1.7)

- **Token hashing pattern to reuse verbatim:** [auth.service.ts:24-30](../../backend/src/modules/auth/auth.service.ts#L24-L30) already has `hashRefreshToken()` (`createHash('sha256').update(token).digest('hex')`) and a Redis-key builder (`refreshRedisKey`). The reset-token hash uses the **identical** `createHash('sha256')` call — don't import a different hashing utility.
- **`validateUser`'s identical-message-for-different-causes pattern** (unknown email vs wrong password both throw the same `UnauthorizedException('Invalid email or password')`, timing-normalized via `DUMMY_PASSWORD_HASH`) is the direct precedent for AC 2/3's "reveal nothing" / "no distinction" requirements — read [auth.service.ts:32-61](../../backend/src/modules/auth/auth.service.ts#L32-L61) before implementing `requestPasswordReset`/`resetPassword`. Note: AC 2's "reveal nothing" needs the **HTTP response** to be identical (controller always returns the same message) — but that is necessary, not sufficient. ~~A bcrypt-style timing-normalization trick is not required here since there's no password comparison in the unknown-email path, just an absent DB row and a skipped email call.~~ **Corrected during the code review (2026-07-23):** this reasoning missed that the skipped call is a *live network round-trip to Resend*, so awaiting it made the known-email path hundreds of milliseconds slower than the unknown one — a latency oracle that enumerates accounts just as effectively as a different message would. The fix is not a timing-normalization trick but simply not awaiting the send (`void this.dispatchResetEmail(...)`), which removes the difference instead of masking it.
- **`ConfigService.get<string>(...)`, never `process.env`** in module code — every story since 1.5 follows this; the three new config keys (Task 2) go through it.
- **bcrypt cost is 10, `bcryptjs` (not `bcrypt`)** — [[prisma7-dev-env-gotchas]]; reuse `import * as bcrypt from 'bcryptjs'` already imported in `auth.service.ts`.
- **Single-cause errors carry no `errorCode`** (Story 1.7's 429, Stories 1.5/1.6's 401/403) — this story's 422 follows the same rule (see Scope guardrails above).
- **E2E precedent is no-real-infra, in-spec/overridden providers** ([roles-guard.e2e-spec.ts](../../backend/test/roles-guard.e2e-spec.ts), [login-rate-limit.e2e-spec.ts](../../backend/test/login-rate-limit.e2e-spec.ts)) — this story's e2e follows the same shape but fakes `PrismaService` + `EMAIL_SENDER` instead of Redis.
- **Dev-Agent-Record honesty is reviewed every story** — record exactly which commands/smokes were actually run; if no real Resend key exists in this environment, say so rather than claiming the live email was sent. [Source: 1-5/1-6/1-7 Dev Agent Records]
- **Node 24 via `fnm`** for all backend builds/tests/migrations. [[prisma7-dev-env-gotchas]]
- **Frontend login page's own comment** ([login-page.tsx:20-27](../../frontend/src/features/auth/login-page.tsx#L20-L27)) explicitly says the forgot-password link was removed because the feature didn't exist yet — this story is what makes that comment stale; update the page rather than leaving a now-incorrect comment in place.

### Architecture compliance

- **AD-17 (auth infra):** "Password reset uses a separate short-lived token" — realized by `PasswordResetToken` being a wholly separate table/lifecycle from the JWT access/refresh tokens, with its own short TTL (30 min, configurable) distinct from `JWT_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN`. [Source: ARCHITECTURE-SPINE.md#AD-17]
- **AD-10 (server-authoritative trust boundary):** passwords stored hashed (bcrypt), never plaintext, including the new password set via reset. [Source: ARCHITECTURE-SPINE.md#AD-10]
- **AD-05 (single-writer table ownership):** `password_reset_tokens` is owned by `auth`, same as `users` — no other module ever touches either table. [Source: ARCHITECTURE-SPINE.md#AD-05]
- **AD-16 (envelope/errors):** the 422 is single-cause, no `errorCode`; success responses (`{ message }`) flow through the existing global `ResponseInterceptor` unchanged — no new envelope shape. [Source: ARCHITECTURE-SPINE.md#AD-16]
- **NFR-09 (AI/email operating cost):** Resend free tier keeps this at zero cost for capstone scale, mirroring the Gemini free-tier constraint already accepted elsewhere. [Source: SRS §4 NFR-09]

### Project Structure Notes

**New (backend):**
- `backend/src/common/email/email-sender.ts`
- `backend/src/common/email/resend-email-sender.service.ts`
- `backend/src/common/email/resend-email-sender.service.spec.ts`
- `backend/src/modules/auth/dto/request-password-reset.dto.ts`
- `backend/src/modules/auth/dto/reset-password.dto.ts`
- `backend/src/prisma/migrations/<timestamp>_password_reset_tokens/migration.sql` (generated by `prisma migrate dev`)
- `backend/test/password-reset.e2e-spec.ts`

**Modified (backend):**
- `backend/src/prisma/schema.prisma` (+`PasswordResetToken` model, +`User.passwordResetTokens` back-relation)
- `backend/src/modules/auth/auth.service.ts` (+`requestPasswordReset`, +`resetPassword`, +`EMAIL_SENDER` injection)
- `backend/src/modules/auth/auth.service.spec.ts` (+new test cases)
- `backend/src/modules/auth/auth.controller.ts` (+`forgot-password`, +`reset-password` routes)
- `backend/src/modules/auth/auth.module.ts` (+`{ provide: EMAIL_SENDER, useClass: ResendEmailSenderService }`)

**New (frontend):**
- `frontend/src/features/auth/forgot-password-page.tsx` (+`.test.tsx`)
- `frontend/src/features/auth/reset-password-page.tsx` (+`.test.tsx`)

**Modified (frontend):**
- `frontend/src/features/auth/login-page.tsx` (+"Quên mật khẩu?" link)
- `frontend/src/routes/router.tsx` (+two public routes)

**Modified (repo root):**
- `.env.example` (+`EMAIL_FROM_ADDRESS`, +`PASSWORD_RESET_TOKEN_TTL_MINUTES`, +`FRONTEND_BASE_URL`; `EMAIL_PROVIDER_API_KEY` already present)

### Testing requirements

- Password reset is **not** one of PROJECT-STANDARDS §7's three merge-blocking Must-Have areas (grading/submission, role access, assign gate) — but AC 2's "reveal nothing" is a real security property and must not be skipped; the unit test asserting **identical behavior/response** for known vs. unknown email is the load-bearing test here.
- **The non-obvious locks:** (1) unknown-email path performs **zero** side effects (no token row, no email call) yet the controller still returns the same 200/message — test both layers. (2) All three reset-token failure causes (unknown/used/expired) throw the **same** exception instance shape/message — a test asserting message equality across all three, mirroring the existing `validateUser` test. (3) The password-update + token-`usedAt` write must be one transaction — a test can assert `$transaction` was called with both operations rather than two separate `.update()` calls.
- No new test infrastructure needed — Jest + supertest (backend), Vitest + Testing Library (frontend) already present; fakes live inline in spec files (Prisma fake, email-sender fake) per the established no-external-infra precedent.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8: Password reset via email] — the 3 ACs
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-17] — password reset uses a separate short-lived token
- [Source: ARCHITECTURE-SPINE.md#AD-05] — single-writer table ownership (`auth` owns the new table)
- [Source: ARCHITECTURE-SPINE.md#AD-16] — envelope/error conventions, single-cause errorCode rule
- [Source: ARCHITECTURE-SPINE.md#Deferred] — "Password-reset email provider (FR-3) — SMTP/provider choice open; a stub is acceptable" — the tension this story resolves (see Dev Notes)
- [Source: _bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/addendum.md#A] — FR-3 ↔ AUTH-03 traceability
- [Source: SRS.md AUTH-03] — original requirement wording ("đặt lại mật khẩu qua email xác thực")
- [Source: _bmad-output/implementation-artifacts/1-7-login-rate-limiting.md] — no-new-dependency precedent, single-cause-no-errorCode convention, no-real-infra e2e pattern, honesty note
- [Source: _bmad-output/implementation-artifacts/1-5-email-password-login-with-jwt-and-role-routing.md] — token/session infra this story extends
- Codebase state verified directly: `backend/src/modules/auth/{auth.service.ts,auth.controller.ts,auth.module.ts,auth.service.spec.ts,dto/login.dto.ts}`, `backend/src/prisma/{schema.prisma,seed.ts}`, `backend/src/common/{redis/redis.service.ts,filters/http-exception.filter.ts,exceptions/error-codes.ts,configure-app.ts}`, `backend/src/app.module.ts`, `backend/package.json`, root `.env.example`, `frontend/src/features/auth/{login-page.tsx,login-page.test.tsx}`, `frontend/src/{contexts/auth-context.ts,providers/auth-provider.tsx,lib/api-client.ts,routes/router.tsx,hooks/use-auth.ts}`, `frontend/package.json`, `docs/stitch_exports/Login/code.html`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via the bmad-dev-story workflow.

### Debug Log References

- `npx prisma migrate dev --name password_reset_tokens` — applied `20260723065209_password_reset_tokens` cleanly; `npx prisma generate` confirmed `prisma.passwordResetToken` present in the generated client (Task 1 gotcha check).
- Prisma 7.8.0's `$transaction` supports both the array-of-promises and interactive-callback forms; used the array-of-promises form in `resetPassword()` (Scope guardrails note in Dev Notes).
- Hit the known `ts-jest`/generated-client ESM gotcha on the *first* e2e spec that transitively imports `PrismaService` (`password-reset.e2e-spec.ts`) — `Cannot find module './internal/class.js'`. Fixed by adding the same `moduleNameMapper` (`"^(\\.{1,2}/.*)\\.js$": "$1"`) to `test/jest-e2e.json` that Story 1.5 already applied to the unit-test Jest config.
- Backend suite: 11 unit suites / 60 tests (up from 10/53), 4 e2e suites / 18 tests (up from 3/15) — all green. `npm run lint` and `npm run build` clean.
- Frontend suite: 6 test files / 14 tests (up from 4 files / 9 tests) — all green. `npm run lint` (oxlint) and `npm run build` clean.
- **Post-review (2026-07-23), after applying the code-review patches:** backend 11 unit suites / **68** tests and 4 e2e suites / **22** tests; frontend 6 files / **17** tests. Lint and build clean on both sides (Node 24 via `fnm` — the frontend suite fails to start on Node 20 with `ERR_REQUIRE_ESM` from jsdom's css dependency, so the version is not optional here).
- Manual smoke (honest disclosure, per Stories 1.5–1.7 precedent): no real `EMAIL_PROVIDER_API_KEY` (Resend) is configured in this environment's `backend/.env` (the placeholder value from `.env.example` is in effect), so the literal "email arrives in an inbox" check was **not** performed.
  - What **was** verified live against the running dev stack (real Postgres + real Redis, `npm run start:dev`):
    - `POST /api/auth/forgot-password` for a seeded email (`student1@onthi12.local`) and an unseeded email return byte-identical `200` bodies (AC 2) — confirmed via `curl`.
    - The Resend call fails against the placeholder key; the failure is caught and logged server-side as `password reset email dispatch failed for user <id>` (no email/link/key in the log), and the HTTP response still succeeds — confirming AC 2 holds even when the email provider is down.
    - `POST /api/auth/reset-password` with a bogus token returns `422` with the generic message and no `errorCode`.
    - To exercise the full valid-token path without a real inbox, a reset-token row was inserted directly into Postgres with a known raw token's SHA-256 hash; `reset-password` with that raw token returned `200`, and a subsequent `login` with the new password succeeded — confirming the password hash update, and replaying the same token afterward correctly returned `422` (single-use enforced).
    - Cleaned up afterward: deleted the manually-inserted token row and restored `student1`'s original seed password hash so the shared dev DB is unaffected.
  - Automated tests (unit + e2e, fake `EmailSender`) already cover the full logic end-to-end; only the literal third-party email delivery is unverified here.
  - No browser-automation tool was available in this environment to visually screenshot `/forgot-password` and `/reset-password`; verification of the frontend pages relied on the passing Vitest component tests (`forgot-password-page.test.tsx`, `reset-password-page.test.tsx`) plus a clean `tsc -b && vite build`.

### Completion Notes List

- Implemented `PasswordResetToken` (Prisma model + migration), the provider-agnostic `EmailSender` interface with a Resend implementation (`fetch`-only, no new npm dependency), `AuthService.requestPasswordReset()`/`resetPassword()`, the two `@Public()` controller routes, and the forgot/reset-password frontend pages + routing.
- AC 2 ("reveal nothing") is enforced at both layers: `requestPasswordReset()` performs zero side effects for an unknown email (no token row, no email call), and the controller returns the identical message/status regardless — verified by unit test, e2e test, and live curl smoke test.
- AC 3's "no distinction" is enforced by a single `UnprocessableEntityException('Invalid or expired reset token')` thrown for all three causes (unknown/used/expired token), verified by a test asserting message equality across all three.
- The password-hash update and token `usedAt` write happen inside one `prisma.$transaction([...])` (array-of-promises form) — the first multi-write transaction in the codebase — closing the race where two concurrent requests with the same still-valid token could otherwise both succeed.
- `error-codes.ts` was left untouched (the 422 is single-cause, per the Scope guardrails note).
- No rate limiting was added to either new route (out of scope per AD-19 — only login and the future AI-parse-enqueue endpoint are named).
- Fixed a latent gap in the e2e Jest config: `test/jest-e2e.json` was missing the `moduleNameMapper` fix that the unit-test Jest config already had for the generated-Prisma-client ESM import issue — this story's e2e spec was the first to transitively import `PrismaService`, surfacing it.

### File List

**New (backend):**
- `backend/src/common/email/email-sender.ts`
- `backend/src/common/email/resend-email-sender.service.ts`
- `backend/src/common/email/resend-email-sender.service.spec.ts`
- `backend/src/modules/auth/dto/request-password-reset.dto.ts`
- `backend/src/modules/auth/dto/reset-password.dto.ts`
- `backend/src/prisma/migrations/20260723065209_password_reset_tokens/migration.sql`
- `backend/test/password-reset.e2e-spec.ts`

**Modified (backend):**
- `backend/src/prisma/schema.prisma` (+`PasswordResetToken` model, +`User.passwordResetTokens` back-relation)
- `backend/src/modules/auth/auth.service.ts` (+`requestPasswordReset`, +`resetPassword`, +`EMAIL_SENDER` injection, +`hashResetToken`)
- `backend/src/modules/auth/auth.service.spec.ts` (+new test cases, extended `buildService()` fixture)
- `backend/src/modules/auth/auth.controller.ts` (+`forgot-password`, +`reset-password` routes)
- `backend/src/modules/auth/auth.module.ts` (+`{ provide: EMAIL_SENDER, useClass: ResendEmailSenderService }`)
- `backend/test/jest-e2e.json` (+`moduleNameMapper` fix for the generated Prisma client's ESM `.js` imports)

**New (frontend):**
- `frontend/src/features/auth/forgot-password-page.tsx` (+`.test.tsx`)
- `frontend/src/features/auth/reset-password-page.tsx` (+`.test.tsx`)

**Modified (frontend):**
- `frontend/src/features/auth/login-page.tsx` (+"Quên mật khẩu?" link, updated stale comment)
- `frontend/src/routes/router.tsx` (+two public routes)

**Modified (repo root):**
- `.env.example` (+`EMAIL_FROM_ADDRESS`, +`PASSWORD_RESET_TOKEN_TTL_MINUTES`, +`FRONTEND_BASE_URL`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story status bookkeeping)

**Added by the code review (2026-07-23):**
- `backend/src/common/config/positive-int-config.ts` (new) — `getPositiveIntConfig()` extracted out of `login-rate-limit.guard.ts` so both the reset TTL and the rate-limit windows parse env values the same way
- `backend/src/common/guards/login-rate-limit.guard.ts` — imports the extracted helper instead of its own copy
- `docs/PROJECT-STANDARDS.md` — §8 required-env table extended with the four email/reset variables
- `backend/src/prisma/migrations/migration_lock.toml` — reverted; the earlier diff was pure LF→CRLF churn from running `prisma migrate dev` on Windows, on a file whose header says not to edit it manually
