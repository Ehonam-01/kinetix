import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" throws unless resolved under Next's "react-server"
      // export condition, which Vitest doesn't set — same issue as the
      // --conditions=react-server flag used for the live-DB verification
      // scripts in earlier phases. server-only/empty.js isn't reachable
      // as a bare specifier (its package.json only exports that path
      // under the react-server condition) — aliasing to the resolved
      // absolute file path bypasses the exports map's condition check
      // entirely instead of fighting Vite/Vitest's SSR condition
      // resolution.
      "server-only": path.resolve(
        import.meta.dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // Fake credentials so modules that validate env at import time
      // (e.g. config/env.moneroo.ts) don't throw during unit tests — never
      // real secrets, this file is committed.
      MONEROO_SECRET_KEY: "test_unit_test_fake_key",
      MONEROO_WEBHOOK_SECRET: "test_unit_test_fake_webhook_secret",
      BICTORYS_SECRET_KEY: "test_unit_test_fake_key",
      BICTORYS_WEBHOOK_SECRET: "test_unit_test_fake_webhook_secret",
      BICTORYS_MERCHANT_SECRET_CODE: "1234",
    },
  },
});
