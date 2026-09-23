import { describe, expect, it } from "vitest";
import { findDashboardSectionLabel } from "./nav-items";

describe("findDashboardSectionLabel", () => {
  it("matches the overview only on the exact /dashboard path", () => {
    expect(findDashboardSectionLabel("/dashboard")).toBe("Vue d'ensemble");
  });

  it("does not match the overview for a deeper path", () => {
    expect(findDashboardSectionLabel("/dashboard/network")).not.toBe(
      "Vue d'ensemble",
    );
  });

  it("resolves a course detail route to the Cours section", () => {
    expect(findDashboardSectionLabel("/dashboard/courses/abc-123")).toBe(
      "Cours",
    );
  });

  it("resolves the network page regardless of its search params", () => {
    // findDashboardSectionLabel only ever receives the pathname (see
    // dashboard-topbar.tsx's usePathname()), never the query string, so a
    // route like /dashboard/network?level=2 is passed in as plain
    // "/dashboard/network".
    expect(findDashboardSectionLabel("/dashboard/network")).toBe("Mon réseau");
  });

  it("resolves the transfer page to the Transférer section", () => {
    expect(findDashboardSectionLabel("/dashboard/transfer")).toBe("Transférer");
  });

  it("resolves the withdrawals page to the Retraits section", () => {
    expect(findDashboardSectionLabel("/dashboard/withdrawals")).toBe(
      "Retraits",
    );
  });

  it("resolves the subscription page to the Mon abonnement section", () => {
    expect(findDashboardSectionLabel("/dashboard/subscription")).toBe(
      "Mon abonnement",
    );
  });

  it("resolves the mentors directory to the Mentorat section", () => {
    expect(findDashboardSectionLabel("/dashboard/mentors")).toBe("Mentorat");
  });

  it("falls back to a generic label for an unrecognized path", () => {
    expect(findDashboardSectionLabel("/dashboard/does-not-exist")).toBe(
      "Tableau de bord",
    );
  });
});
