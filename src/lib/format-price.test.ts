import { describe, expect, it } from "vitest";
import { formatAmount, formatPrice } from "./format-price";

describe("formatPrice", () => {
  it("groups thousands and keeps the F on the same line", () => {
    expect(formatPrice(45000)).toBe("45\u202f000\u00a0F");
    expect(formatPrice(1250000)).toBe("1\u202f250\u202f000\u00a0F");
    expect(formatPrice(900)).toBe("900\u00a0F");
    expect(formatAmount(-6750)).toBe("-6\u202f750");
  });
});
