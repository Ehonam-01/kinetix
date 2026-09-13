import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { monerooProvider } from "./moneroo";

// Must match vitest.config.ts's test.env.MONEROO_WEBHOOK_SECRET.
const secret = "test_unit_test_fake_webhook_secret";

function sign(body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("monerooProvider.parseWebhook", () => {
  it("accepts a correctly signed payload and maps payment.success to CONFIRMED", () => {
    const body = JSON.stringify({
      event: "payment.success",
      data: { id: "tx_123", status: "success", amount: 4500 },
    });
    const event = monerooProvider.parseWebhook(body, sign(body));

    expect(event.providerReference).toBe("tx_123");
    expect(event.status).toBe("CONFIRMED");
    expect(event.eventType).toBe("payment.success");
    expect(event.dedupeKey).toBe("payment.success:tx_123");
  });

  it("maps payment.failed and payment.cancelled to FAILED", () => {
    const failedBody = JSON.stringify({
      event: "payment.failed",
      data: { id: "tx_1", status: "failed", amount: 100 },
    });
    expect(
      monerooProvider.parseWebhook(failedBody, sign(failedBody)).status,
    ).toBe("FAILED");

    const cancelledBody = JSON.stringify({
      event: "payment.cancelled",
      data: { id: "tx_2", status: "cancelled", amount: 100 },
    });
    expect(
      monerooProvider.parseWebhook(cancelledBody, sign(cancelledBody)).status,
    ).toBe("FAILED");
  });

  it("maps payment.initiated to PENDING", () => {
    const body = JSON.stringify({
      event: "payment.initiated",
      data: { id: "tx_3", status: "pending", amount: 100 },
    });
    expect(monerooProvider.parseWebhook(body, sign(body)).status).toBe(
      "PENDING",
    );
  });

  it("rejects a payload with no signature", () => {
    const body = JSON.stringify({
      event: "payment.success",
      data: { id: "tx_4", status: "success", amount: 100 },
    });
    expect(() => monerooProvider.parseWebhook(body, null)).toThrow();
  });

  it("rejects a payload with an incorrect signature", () => {
    const body = JSON.stringify({
      event: "payment.success",
      data: { id: "tx_5", status: "success", amount: 100 },
    });
    expect(() => monerooProvider.parseWebhook(body, "0".repeat(64))).toThrow();
  });

  it("rejects a payload that was tampered with after signing", () => {
    const original = JSON.stringify({
      event: "payment.success",
      data: { id: "tx_6", status: "success", amount: 100 },
    });
    const signature = sign(original);
    const tampered = JSON.stringify({
      event: "payment.success",
      data: { id: "tx_6", status: "success", amount: 999999 },
    });
    expect(() => monerooProvider.parseWebhook(tampered, signature)).toThrow();
  });

  it("produces distinct dedupe keys for different events on the same transaction", () => {
    const initiated = JSON.stringify({
      event: "payment.initiated",
      data: { id: "tx_7", status: "pending", amount: 100 },
    });
    const success = JSON.stringify({
      event: "payment.success",
      data: { id: "tx_7", status: "success", amount: 100 },
    });
    const a = monerooProvider.parseWebhook(
      initiated,
      sign(initiated),
    ).dedupeKey;
    const b = monerooProvider.parseWebhook(success, sign(success)).dedupeKey;
    expect(a).not.toBe(b);
  });

  it("produces the same dedupe key for a redelivered identical event", () => {
    const body = JSON.stringify({
      event: "payment.success",
      data: { id: "tx_8", status: "success", amount: 100 },
    });
    const signature = sign(body);
    const first = monerooProvider.parseWebhook(body, signature).dedupeKey;
    const second = monerooProvider.parseWebhook(body, signature).dedupeKey;
    expect(first).toBe(second);
  });
});
