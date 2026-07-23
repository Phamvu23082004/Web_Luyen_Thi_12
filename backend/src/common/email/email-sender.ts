// Injection token + interface so the email provider is swappable (Story 1.8
// Dev Notes: "provider-agnostic email interface") — only the Resend
// implementation changes if the provider is swapped later, never callers.
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailSender {
  sendPasswordResetEmail(to: string, resetLink: string): Promise<void>;
}
