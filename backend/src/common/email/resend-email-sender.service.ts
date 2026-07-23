import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailSender } from './email-sender';

const RESEND_API_URL = 'https://api.resend.com/emails';

// Node's global fetch has no default timeout: a provider that accepts the
// connection and never answers would otherwise hold the dispatch (and its
// socket) open indefinitely (NFR-11).
const REQUEST_TIMEOUT_MS = 5000;

// Calls Resend directly via the global `fetch` (Node 24 has it natively) —
// no `resend` SDK dependency, matching Story 1.7's hand-rolled-over-library
// precedent for a single-purpose integration.
@Injectable()
export class ResendEmailSenderService implements EmailSender {
  private readonly logger = new Logger(ResendEmailSenderService.name);

  constructor(private readonly config: ConfigService) {
    // Missing credentials otherwise surface only as a swallowed 401 the first
    // time a real user asks for a reset — flag them at boot instead.
    for (const key of ['EMAIL_PROVIDER_API_KEY', 'EMAIL_FROM_ADDRESS']) {
      if (!this.config.get<string>(key)?.trim()) {
        this.logger.error(
          `${key} is not set — password reset emails will fail`,
        );
      }
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const html = `
      <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản OnThi12.</p>
      <p><a href="${resetLink}">Nhấn vào đây để đặt lại mật khẩu</a></p>
      <p>Hoặc sao chép liên kết sau vào trình duyệt: ${resetLink}</p>
    `;

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get<string>('EMAIL_PROVIDER_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get<string>('EMAIL_FROM_ADDRESS'),
        to,
        subject: 'Đặt lại mật khẩu OnThi12',
        html,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      // The status is the diagnostic — 401 (bad key), 403 (unverified sender)
      // and 429 (quota) are otherwise indistinguishable in the caller's log.
      // Never include the API key or the reset link.
      throw new Error(
        `Failed to send password reset email (Resend responded ${res.status})`,
      );
    }
  }
}
