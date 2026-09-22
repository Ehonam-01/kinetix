import { describe, expect, it } from "vitest";
import {
  computeDirectSaleCommission,
  computeGenerationCommission,
  isGenerationQualified,
  type EffectiveCommissionRule,
} from "./commission-rules";

function rule(
  overrides: Partial<EffectiveCommissionRule>,
): EffectiveCommissionRule {
  return {
    id: "rule-1",
    scope: "DIRECT_SALE",
    courseId: null,
    category: null,
    levelCode: null,
    generation: null,
    commissionType: "FIXED",
    rate: 0,
    cap: null,
    minimumBv: null,
    qualificationRequirement: null,
    effectiveFrom: new Date(),
    effectiveTo: null,
    createdBy: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("computeDirectSaleCommission", () => {
  it("FIXED: returns the rate as-is, in F CFA", () => {
    const amount = computeDirectSaleCommission(
      rule({ commissionType: "FIXED", rate: 2000 }),
      { pricePaid: 25000, businessVolume: 20000, bvValueInCfa: 1 },
    );
    expect(amount).toBe(2000);
  });

  it("PERCENTAGE: rate is basis points of the price paid", () => {
    // 800 basis points = 8.00% of 25000 = 2000
    const amount = computeDirectSaleCommission(
      rule({ commissionType: "PERCENTAGE", rate: 800 }),
      { pricePaid: 25000, businessVolume: 20000, bvValueInCfa: 1 },
    );
    expect(amount).toBe(2000);
  });

  it("BV_PERCENTAGE: rate is basis points of the Business Volume converted to F CFA, not the price", () => {
    // 20 BV points x 1000 F CFA/point = 20000 F CFA of BV, 10% of it = 2000,
    // ignoring the 25000 price.
    const amount = computeDirectSaleCommission(
      rule({ commissionType: "BV_PERCENTAGE", rate: 1000 }),
      { pricePaid: 25000, businessVolume: 20, bvValueInCfa: 1000 },
    );
    expect(amount).toBe(2000);
  });

  it("rounds down rather than producing a fractional F CFA amount", () => {
    // 333 basis points = 3.33% of 10000 = 333.0 exactly here, use an amount
    // that doesn't divide evenly to prove the floor.
    const amount = computeDirectSaleCommission(
      rule({ commissionType: "PERCENTAGE", rate: 333 }),
      { pricePaid: 10001, businessVolume: 0, bvValueInCfa: 1000 },
    );
    expect(amount).toBe(Math.floor((10001 * 333) / 10_000));
    expect(Number.isInteger(amount)).toBe(true);
  });

  it("caps the amount when a cap is set, regardless of commissionType", () => {
    const amount = computeDirectSaleCommission(
      rule({ commissionType: "FIXED", rate: 5000, cap: 3000 }),
      { pricePaid: 0, businessVolume: 0, bvValueInCfa: 1000 },
    );
    expect(amount).toBe(3000);
  });

  it("leaves the amount untouched when it is already under the cap", () => {
    const amount = computeDirectSaleCommission(
      rule({ commissionType: "FIXED", rate: 1000, cap: 3000 }),
      { pricePaid: 0, businessVolume: 0, bvValueInCfa: 1000 },
    );
    expect(amount).toBe(1000);
  });
});

describe("computeGenerationCommission", () => {
  it("FIXED: rate scaled by the generation's required headcount", () => {
    const amount = computeGenerationCommission(
      rule({ commissionType: "FIXED", rate: 2000 }),
      {
        bvTotal: 0,
        requiredCount: 4,
        bvValueInCfa: 1000,
        subscriptionPriceInCfa: 0,
      },
    );
    expect(amount).toBe(8000);
  });

  it("PERCENTAGE: basis points of the generation's total subscription revenue (requiredCount x price)", () => {
    // 4 people x 15000 F/subscription = 60000 F revenue, 10% of it = 6000.
    const amount = computeGenerationCommission(
      rule({ commissionType: "PERCENTAGE", rate: 1000 }), // 10%
      {
        bvTotal: 0,
        requiredCount: 4,
        bvValueInCfa: 1000,
        subscriptionPriceInCfa: 15000,
      },
    );
    expect(amount).toBe(6000);
  });

  it("BV_PERCENTAGE: basis points of the generation's accumulated BV, converted to F CFA via bvValueInCfa", () => {
    // 50 BV points x 1000 F CFA/point = 50000 F CFA, 10% of it = 5000.
    const amount = computeGenerationCommission(
      rule({ commissionType: "BV_PERCENTAGE", rate: 1000 }), // 10%
      {
        bvTotal: 50,
        requiredCount: 4,
        bvValueInCfa: 1000,
        subscriptionPriceInCfa: 0,
      },
    );
    expect(amount).toBe(5000);
  });

  it("BV_PERCENTAGE: a bvValueInCfa of 1 is a pure passthrough (BV already in F CFA)", () => {
    const amount = computeGenerationCommission(
      rule({ commissionType: "BV_PERCENTAGE", rate: 1000 }), // 10%
      {
        bvTotal: 50000,
        requiredCount: 4,
        bvValueInCfa: 1,
        subscriptionPriceInCfa: 0,
      },
    );
    expect(amount).toBe(5000);
  });

  it("caps the amount regardless of commissionType", () => {
    const amount = computeGenerationCommission(
      rule({ commissionType: "FIXED", rate: 2000, cap: 5000 }),
      {
        bvTotal: 0,
        requiredCount: 8,
        bvValueInCfa: 1000,
        subscriptionPriceInCfa: 0,
      }, // would be 16000 uncapped
    );
    expect(amount).toBe(5000);
  });
});

describe("isGenerationQualified", () => {
  const row = { currentCount: 2, requiredCount: 2, bvTotal: 30000 };

  it("no requirement (no rule at all) falls back to presence only — backward compatible", () => {
    expect(isGenerationQualified(null, row)).toBe(true);
    expect(isGenerationQualified(null, { ...row, currentCount: 1 })).toBe(
      false,
    );
  });

  it("a rule with an empty requirement object also falls back to presence only", () => {
    expect(isGenerationQualified({}, row)).toBe(true);
    expect(isGenerationQualified({}, { ...row, currentCount: 0 })).toBe(false);
  });

  it("minBv alone gates on BV only, ignoring headcount", () => {
    expect(
      isGenerationQualified({ minBv: 20000 }, { ...row, currentCount: 0 }),
    ).toBe(true);
    expect(isGenerationQualified({ minBv: 40000 }, row)).toBe(false);
  });

  it("presence + minBv together require both", () => {
    const requirement = { presence: true, minBv: 20000 };
    expect(isGenerationQualified(requirement, row)).toBe(true);
    expect(
      isGenerationQualified(requirement, { ...row, currentCount: 0 }),
    ).toBe(false);
    expect(isGenerationQualified(requirement, { ...row, bvTotal: 100 })).toBe(
      false,
    );
  });

  it("TEST 8 of the master prompt: headcount alone met, but the configured minBv is not — no qualification", () => {
    // "5 members left, 5 right" (headcount clearly satisfied) is not
    // automatically a completed generation once a stricter rule is
    // configured — modeled here as currentCount already at/above
    // requiredCount while bvTotal falls short of the configured minimum.
    const fullHeadcountLowVolume = {
      currentCount: 8,
      requiredCount: 8,
      bvTotal: 1000,
    };
    expect(
      isGenerationQualified(
        { presence: true, minBv: 100000 },
        fullHeadcountLowVolume,
      ),
    ).toBe(false);
  });
});
