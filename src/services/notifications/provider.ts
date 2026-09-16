// Provider-agnostic contract, same pattern as services/payments/provider.ts:
// the rest of the app depends on this interface only, never on a specific
// vendor. See resend-email.ts for the current concrete implementation.

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  // Optional plain-text alternative — an HTML-only email is a real spam
  // signal to most filters (near-universal in actual spam campaigns), so a
  // multipart email scores better. Optional rather than mandatory: existing
  // OTP emails stay html-only for now, this is opt-in per call.
  text?: string;
};

export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<void>;
}
