import { describe, expect, it } from "vitest";
import { bictorysProvider } from "./bictorys";

// Must match vitest.config.ts's test.env.BICTORYS_WEBHOOK_SECRET.
const secret = "test_unit_test_fake_webhook_secret";

describe("bictorysProvider.parseWebhook", () => {
  it("accepts a payload with the correct X-Secret-Key and maps succeeded to CONFIRMED", () => {
    const body = JSON.stringify({
      id: "tx_123",
      status: "succeeded",
      amount: 4500,
      currency: "XOF",
    });
    const event = bictorysProvider.parseWebhook(body, secret);

    expect(event.providerReference).toBe("tx_123");
    expect(event.status).toBe("CONFIRMED");
    expect(event.eventType).toBe("succeeded");
    expect(event.dedupeKey).toBe("tx_123:succeeded");
  });

  it("maps failed, cancelled and reversed to FAILED", () => {
    for (const status of ["failed", "cancelled", "reversed"]) {
      const body = JSON.stringify({
        id: `tx_${status}`,
        status,
        amount: 100,
        currency: "XOF",
      });
      expect(bictorysProvider.parseWebhook(body, secret).status).toBe(
        "FAILED",
      );
    }
  });

  it("maps pending, processing and authorized to PENDING", () => {
    for (const status of ["pending", "processing", "authorized"]) {
      const body = JSON.stringify({
        id: `tx_${status}`,
        status,
        amount: 100,
        currency: "XOF",
      });
      expect(bictorysProvider.parseWebhook(body, secret).status).toBe(
        "PENDING",
      );
    }
  });

  it("rejects a payload with no X-Secret-Key header", () => {
    const body = JSON.stringify({
      id: "tx_4",
      status: "succeeded",
      amount: 100,
      currency: "XOF",
    });
    expect(() => bictorysProvider.parseWebhook(body, null)).toThrow();
  });

  it("rejects a payload with an incorrect secret", () => {
    const body = JSON.stringify({
      id: "tx_5",
      status: "succeeded",
      amount: 100,
      currency: "XOF",
    });
    expect(() =>
      bictorysProvider.parseWebhook(body, "not_the_real_secret"),
    ).toThrow();
  });

  it("produces distinct dedupe keys for a status transition on the same transaction", () => {
    const pending = JSON.stringify({
      id: "tx_7",
      status: "pending",
      amount: 100,
      currency: "XOF",
    });
    const succeeded = JSON.stringify({
      id: "tx_7",
      status: "succeeded",
      amount: 100,
      currency: "XOF",
    });
    const a = bictorysProvider.parseWebhook(pending, secret).dedupeKey;
    const b = bictorysProvider.parseWebhook(succeeded, secret).dedupeKey;
    expect(a).not.toBe(b);
  });

  it("produces the same dedupe key for a redelivered identical event", () => {
    const body = JSON.stringify({
      id: "tx_8",
      status: "succeeded",
      amount: 100,
      currency: "XOF",
    });
    const first = bictorysProvider.parseWebhook(body, secret).dedupeKey;
    const second = bictorysProvider.parseWebhook(body, secret).dedupeKey;
    expect(first).toBe(second);
  });
});
