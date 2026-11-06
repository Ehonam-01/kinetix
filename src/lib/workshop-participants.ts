// Every payment attempt is its own registration row (services/workshops/
// register.ts), so someone who tried three times appears three times. The
// admin list shows each person once, by WhatsApp number: their paid seat if
// they have one, else their latest attempt. Rows come newest first
// (listRegistrations), and so does the result.
export function onePerParticipant<
  T extends { whatsapp: string; status: string },
>(registrations: T[]) {
  const byNumber = new Map<
    string,
    T & { attempts: number; paidCount: number }
  >();
  for (const r of registrations) {
    const kept = byNumber.get(r.whatsapp);
    if (!kept) {
      byNumber.set(r.whatsapp, {
        ...r,
        attempts: 1,
        paidCount: r.status === "PAID" ? 1 : 0,
      });
      continue;
    }
    const attempts = kept.attempts + 1;
    const paidCount = kept.paidCount + (r.status === "PAID" ? 1 : 0);
    // An older paid seat wins over a later attempt that didn't go through.
    const shown = kept.status !== "PAID" && r.status === "PAID" ? r : kept;
    byNumber.set(r.whatsapp, { ...shown, attempts, paidCount });
  }
  return [...byNumber.values()];
}
