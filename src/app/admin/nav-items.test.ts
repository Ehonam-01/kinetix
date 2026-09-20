import { describe, expect, it } from "vitest";
import { findAdminSectionLabel } from "./nav-items";

describe("findAdminSectionLabel", () => {
  it("matches the overview only on the exact /admin path", () => {
    expect(findAdminSectionLabel("/admin")).toBe("Vue d'ensemble");
  });

  it("does not match the overview for a deeper path", () => {
    expect(findAdminSectionLabel("/admin/members")).not.toBe("Vue d'ensemble");
  });

  it("resolves a nested route to its section, not the overview", () => {
    expect(findAdminSectionLabel("/admin/courses/new")).toBe("Cours");
    expect(findAdminSectionLabel("/admin/courses/abc-123")).toBe("Cours");
  });

  it("resolves a member detail route to the Membres section", () => {
    expect(findAdminSectionLabel("/admin/members/abc-123")).toBe("Membres");
  });

  it("resolves the transfers page to the Transferts section", () => {
    expect(findAdminSectionLabel("/admin/transfers")).toBe("Transferts");
  });

  it("resolves the recharge page to its own section, not Membres", () => {
    expect(findAdminSectionLabel("/admin/recharge")).toBe(
      "Recharger un compte",
    );
  });

  it("resolves the withdrawals page to the Retraits section", () => {
    expect(findAdminSectionLabel("/admin/withdrawals")).toBe("Retraits");
  });

  it("falls back to a generic label for an unrecognized path", () => {
    expect(findAdminSectionLabel("/admin/does-not-exist")).toBe(
      "Administration",
    );
  });
});
