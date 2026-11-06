import { describe, expect, it } from "vitest";
import { onePerParticipant } from "./workshop-participants";

const row = (id: string, whatsapp: string, status: string) => ({
  id,
  whatsapp,
  status,
});

describe("Workshop participants", () => {
  it("shows a number once, with its paid seat over later failed attempts", () => {
    const rows = [
      row("c", "22896140517", "FAILED"),
      row("b", "22896140517", "PAID"),
      row("a", "22896140517", "PENDING"),
      row("d", "22891598448", "FAILED"),
    ];
    expect(onePerParticipant(rows)).toEqual([
      { ...rows[1], attempts: 3, paidCount: 1 },
      { ...rows[3], attempts: 1, paidCount: 0 },
    ]);
  });

  it("keeps the latest attempt of someone who never paid", () => {
    const rows = [
      row("b", "22890000000", "PENDING"),
      row("a", "22890000000", "FAILED"),
    ];
    expect(onePerParticipant(rows)).toEqual([
      { ...rows[0], attempts: 2, paidCount: 0 },
    ]);
  });

  it("counts a number paid twice, to refund one", () => {
    const rows = [
      row("b", "22890000000", "PAID"),
      row("a", "22890000000", "PAID"),
    ];
    expect(onePerParticipant(rows)).toEqual([
      { ...rows[0], attempts: 2, paidCount: 2 },
    ]);
  });
});
