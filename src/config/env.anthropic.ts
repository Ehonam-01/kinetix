import "server-only";
import { z } from "zod";

const anthropicEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
});

type AnthropicEnv = z.infer<typeof anthropicEnvSchema>;

let cached: AnthropicEnv | undefined;

// Lazy, same reasoning as env.moneroo.ts — only calling this (generating a
// course) needs the key to exist, not booting the app.
export function getAnthropicEnv(): AnthropicEnv {
  cached ??= anthropicEnvSchema.parse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  });
  return cached;
}
