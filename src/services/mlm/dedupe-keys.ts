// Centralized so the exact format used to insert a commission_event and
// the format used to look it up can never silently drift apart (section 15
// — a commission must never be paid twice).
export function levelCommissionDedupeKey(
  userId: string,
  levelCode: number,
  generation: number,
): string {
  return `LEVEL_COMMISSION:${userId}:${levelCode}:${generation}`;
}

export function levelBonusDedupeKey(userId: string): string {
  return `LEVEL_1_BONUS:${userId}`;
}
