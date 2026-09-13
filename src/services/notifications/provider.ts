// Provider-agnostic contract, same pattern as services/payments/provider.ts:
// the rest of the app depends on this interface only, never on a specific
// vendor. See resend-email.ts for the current concrete implementation.

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<void>;
}
