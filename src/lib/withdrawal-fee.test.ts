import { describe, expect, it } from "vitest";
import { computeWithdrawalFee, describeWithdrawalFee } from "./withdrawal-fee";

describe("withdrawal fee", () => {
  it("is zero until the admin sets it", () => {
    expect(computeWithdrawalFee(10_000, { percentBp: 0, fixed: 0 })).toEqual({
      fee: 0,
      net: 10_000,
    });
    expect(describeWithdrawalFee({ percentBp: 0, fixed: 0 })).toBeNull();
  });

  it("adds a percentage of the amount and a fixed part, deducted from it", () => {
    expect(
      computeWithdrawalFee(10_000, { percentBp: 150, fixed: 100 }),
    ).toEqual({ fee: 250, net: 9_750 });
    expect(describeWithdrawalFee({ percentBp: 150, fixed: 100 })).toBe(
      "1,5 % + 100 F",
    );
  });

  it("rounds the percentage down, in the member's favour", () => {
    // 1,5 % of 1 999 = 29,985 -> 29
    expect(computeWithdrawalFee(1_999, { percentBp: 150, fixed: 0 })).toEqual({
      fee: 29,
      net: 1_970,
    });
  });
});
