import { describe, expect, it } from "vitest";
import { filterCurrentSubscriptions } from "./subscriptions";

describe("filterCurrentSubscriptions", () => {
  it("keeps a candidate that is its user's latest subscription", () => {
    const candidates = [
      { id: "s1", userId: "u1", expiresAt: new Date("2027-01-01") },
    ];
    const latest = new Map([["u1", new Date("2027-01-01")]]);
    expect(filterCurrentSubscriptions(candidates, latest)).toEqual(candidates);
  });

  it("drops a stale row still inside the reminder window after a renewal", () => {
    // u1 renewed early: their real current period now expires in 2028, but
    // the old 2027 row (already superseded) still falls inside the
    // "expiring in 7 days" date window a naive query would use.
    const candidates = [
      { id: "old", userId: "u1", expiresAt: new Date("2027-01-01") },
    ];
    const latest = new Map([["u1", new Date("2028-06-15")]]);
    expect(filterCurrentSubscriptions(candidates, latest)).toEqual([]);
  });

  it("handles several users independently", () => {
    const candidates = [
      { id: "a", userId: "u1", expiresAt: new Date("2027-01-01") },
      { id: "b", userId: "u2", expiresAt: new Date("2027-03-01") },
    ];
    const latest = new Map([
      ["u1", new Date("2027-01-01")],
      ["u2", new Date("2029-01-01")], // u2 already renewed past the window
    ]);
    expect(filterCurrentSubscriptions(candidates, latest)).toEqual([
      candidates[0],
    ]);
  });
});
