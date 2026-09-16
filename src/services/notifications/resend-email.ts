import "server-only";
import { getEmailEnv } from "@/config/env.email";
import type { EmailProvider, SendEmailInput } from "./provider";

// https://resend.com/docs/api-reference/emails/send-email — verified
// against the real API: POST /emails, Bearer auth, success returns
// {id: string}. No refund/verify counterpart needed here (unlike
// payments/moneroo.ts) — email sending has no confirmation step to poll.
const BASE_URL = "https://api.resend.com";

export const resendEmailProvider: EmailProvider = {
  async sendEmail(input: SendEmailInput): Promise<void> {
    const response = await fetch(`${BASE_URL}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getEmailEnv().RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getEmailEnv().EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend /emails a répondu ${response.status} : ${body}`);
    }
  },
};
