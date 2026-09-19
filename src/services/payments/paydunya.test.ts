import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { paydunyaProvider } from "./paydunya";

// Must match vitest.config.ts's test.env.PAYDUNYA_MASTER_KEY.
const masterKey = "test_unit_test_fake_master_key";
const validHash = createHash("sha512").update(masterKey).digest("hex");

describe("paydunyaProvider.parseWebhook", () => {
  it("accepts a nested JSON payload and maps completed to CONFIRMED", () => {
    const body = JSON.stringify({
      data: {
        hash: validHash,
        status: "completed",
        invoice: { token: "test_abc123" },
      },
    });
    const event = paydunyaProvider.parseWebhook(body, null);

    expect(event.providerReference).toBe("test_abc123");
    expect(event.status).toBe("CONFIRMED");
    expect(event.dedupeKey).toBe("test_abc123:completed");
  });

  it("accepts a flat (non-nested) JSON payload", () => {
    const body = JSON.stringify({
      hash: validHash,
      status: "completed",
      token: "test_flat456",
    });
    const event = paydunyaProvider.parseWebhook(body, null);
    expect(event.providerReference).toBe("test_flat456");
    expect(event.status).toBe("CONFIRMED");
  });

  it("accepts a form-urlencoded body with a JSON-encoded data field", () => {
    const inner = JSON.stringify({
      hash: validHash,
      status: "completed",
      invoice: { token: "test_form789" },
    });
    const body = `data=${encodeURIComponent(inner)}`;
    const event = paydunyaProvider.parseWebhook(body, null);
    expect(event.providerReference).toBe("test_form789");
    expect(event.status).toBe("CONFIRMED");
  });

  it("maps cancelled and failed to FAILED", () => {
    for (const status of ["cancelled", "failed"]) {
      const body = JSON.stringify({
        hash: validHash,
        status,
        token: `test_${status}`,
      });
      expect(paydunyaProvider.parseWebhook(body, null).status).toBe("FAILED");
    }
  });

  it("maps pending to PENDING", () => {
    const body = JSON.stringify({
      hash: validHash,
      status: "pending",
      token: "test_pending",
    });
    expect(paydunyaProvider.parseWebhook(body, null).status).toBe("PENDING");
  });

  it("rejects a payload with an incorrect hash", () => {
    const body = JSON.stringify({
      hash: "0".repeat(128),
      status: "completed",
      token: "test_bad_hash",
    });
    expect(() => paydunyaProvider.parseWebhook(body, null)).toThrow();
  });

  it("rejects a payload with no invoice token", () => {
    const body = JSON.stringify({ hash: validHash, status: "completed" });
    expect(() => paydunyaProvider.parseWebhook(body, null)).toThrow();
  });

  it("produces distinct dedupe keys for a status transition on the same token", () => {
    const pending = JSON.stringify({
      hash: validHash,
      status: "pending",
      token: "test_transition",
    });
    const completed = JSON.stringify({
      hash: validHash,
      status: "completed",
      token: "test_transition",
    });
    const a = paydunyaProvider.parseWebhook(pending, null).dedupeKey;
    const b = paydunyaProvider.parseWebhook(completed, null).dedupeKey;
    expect(a).not.toBe(b);
  });
});
