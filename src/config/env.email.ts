import "server-only";
import { z } from "zod";

const emailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
});

type EmailEnv = z.infer<typeof emailEnvSchema>;

let cached: EmailEnv | undefined;

// A function, not a module-level constant — same reasoning as
// getMonerooEnv (env.moneroo.ts): only sending a real OTP email should
// require these keys to exist, not booting the whole app.
export function getEmailEnv(): EmailEnv {
  cached ??= emailEnvSchema.parse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  });
  return cached;
}
