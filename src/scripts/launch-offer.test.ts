// End of the launch price, against a disposable pglite database with every
// real migration applied: the admin programs the new price from a date;
// until then members keep paying the launch price and every page gets the
// date, the new price and the saving; past the date the new price applies
// by itself and the launch mention disappears. Reminder emails go out 7
// days, 3 days and the last day before — once per person and stage, to
// members who never paid (not those with a cagnotte open) and to
// ambassadors.
import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { createSimulationDb } from "./simulation-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any;

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));
const sentEmails: { to: string; subject: string; html: string }[] = [];
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: {
    sendEmail: async (input: { to: string; subject: string; html: string }) => {
      sentEmails.push(input);
    },
  },
}));
process.env.SITE_URL ??= "https://kinetix.example";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE = "subscription.price_in_cfa";
const REGULAR = "subscription.regular_price_in_cfa";

async function makeProfile(
  label: string,
  options: {
    role?: "ADMIN";
    status?: "ACTIVE" | "PENDING_PAYMENT";
  } = {},
) {
  const id = randomUUID();
  await localClient.query(
    'INSERT INTO "auth"."users" (id, email) VALUES ($1, $2);',
    [id, `${label}@example.test`],
  );
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `${label} Test`,
    status: options.status ?? "PENDING_PAYMENT",
    role: options.role ?? "USER",
  });
  return id;
}

// A date (YYYY-MM-DD) n days from today.
const dayFromNow = (n: number) =>
  new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10);

describe("launch offer end (pglite)", () => {
  let admin: string;

  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    await db
      .delete(schema.parameterVersions)
      .where(inArray(schema.parameterVersions.parameterKey, [PRICE, REGULAR]));
    await db.insert(schema.parameterVersions).values([
      { parameterKey: PRICE, value: 19500 },
      { parameterKey: REGULAR, value: 55000 },
    ]);
    admin = await makeProfile("admin", { role: "ADMIN", status: "ACTIVE" });
  }, 120_000);

  it("announces the regular price without a date until one is programmed", async () => {
    const { getLaunchOffer } = await import("@/services/pricing/launch-offer");
    expect(await getLaunchOffer(localDb)).toEqual({
      price: 19500,
      nextPrice: 55000,
      endsAt: null,
      savings: 35500,
    });
  });

  it("keeps the launch price until the date, then switches by itself", async () => {
    const { getLaunchOffer, lastLaunchDayLabel } =
      await import("@/services/pricing/launch-offer");
    const { scheduleSubscriptionPriceChange, cancelScheduledPriceChange } =
      await import("@/services/admin/schedule-price-change");
    const { getCurrentParameterValue, getCurrentParameterValueOrNull } =
      await import("@/repositories/parameter-versions");

    await expect(
      scheduleSubscriptionPriceChange(admin, {
        newPrice: 55000,
        startDate: dayFromNow(-1),
      }),
    ).rejects.toThrow("dans le futur");

    await scheduleSubscriptionPriceChange(admin, {
      newPrice: 55000,
      startDate: dayFromNow(40),
    });
    // Programming again replaces the previous programming.
    await scheduleSubscriptionPriceChange(admin, {
      newPrice: 55000,
      startDate: dayFromNow(20),
    });
    const offer = await getLaunchOffer(localDb);
    expect(offer).toMatchObject({
      price: 19500,
      nextPrice: 55000,
      savings: 35500,
    });
    expect(offer.endsAt?.slice(0, 10)).toBe(dayFromNow(20));
    expect(lastLaunchDayLabel("2026-12-01T00:00:00.000Z")).toBe(
      "30 novembre 2026",
    );
    // What a member pays today is unchanged.
    expect(await getCurrentParameterValue(localDb, PRICE)).toBe(19500);

    // The date passes: today's versions started a while ago, the programmed
    // ones a minute ago.
    await localDb.execute(
      sql`UPDATE parameter_versions SET effective_from = now() - interval '30 days' WHERE effective_from <= now()`,
    );
    await localDb.execute(
      sql`UPDATE parameter_versions SET effective_from = now() - interval '1 minute' WHERE effective_from > now()`,
    );
    expect(await getCurrentParameterValue(localDb, PRICE)).toBe(55000);
    expect(await getCurrentParameterValueOrNull(localDb, REGULAR)).toBe(0);
    expect(await getLaunchOffer(localDb)).toEqual({
      price: 55000,
      nextPrice: null,
      endsAt: null,
      savings: null,
    });
    await expect(cancelScheduledPriceChange(admin)).rejects.toThrow(
      "Aucun changement",
    );

    // Back to the launch price for the next test.
    await localDb
      .delete(schema.parameterVersions)
      .where(inArray(schema.parameterVersions.parameterKey, [PRICE, REGULAR]));
    await localDb.insert(schema.parameterVersions).values([
      { parameterKey: PRICE, value: 19500 },
      { parameterKey: REGULAR, value: 55000 },
    ]);
  });

  it("only lets an admin program the price", async () => {
    const { scheduleSubscriptionPriceChange } =
      await import("@/services/admin/schedule-price-change");
    const member = await makeProfile("intrus", { status: "ACTIVE" });
    await expect(
      scheduleSubscriptionPriceChange(member, {
        newPrice: 55000,
        startDate: dayFromNow(10),
      }),
    ).rejects.toThrow("Seul un administrateur");
  });

  it("works out which reminder is due", async () => {
    const { reminderStage } =
      await import("@/services/notifications/launch-offer-emails");
    const end = new Date("2026-12-01T00:00:00Z");
    const at = (iso: string) => reminderStage(end, new Date(iso));
    expect(at("2026-11-23T08:00:00Z")).toBeNull();
    expect(at("2026-11-24T08:00:00Z")).toBe(7);
    expect(at("2026-11-26T08:00:00Z")).toBe(7);
    expect(at("2026-11-28T08:00:00Z")).toBe(3);
    expect(at("2026-11-30T08:00:00Z")).toBe(1);
    expect(at("2026-12-01T08:00:00Z")).toBeNull();
  });

  it("emails non-paying members and ambassadors once per stage", async () => {
    const { scheduleSubscriptionPriceChange } =
      await import("@/services/admin/schedule-price-change");
    const { sendLaunchOfferReminders } =
      await import("@/services/notifications/launch-offer-emails");

    await makeProfile("afi");
    const withPlan = await makeProfile("kossi");
    await localDb
      .insert(schema.installmentPlans)
      .values({ userId: withPlan, targetAmount: 19500 });
    const ambassador = await makeProfile("ama", { status: "ACTIVE" });
    await localDb.insert(schema.ambassadorProfiles).values({
      userId: ambassador,
      referralCode: `AMA${randomUUID().slice(0, 6)}`,
      termsAcceptedAt: new Date(),
      termsVersion: "test",
    });
    await makeProfile("abonne", { status: "ACTIVE" });

    await scheduleSubscriptionPriceChange(admin, {
      newPrice: 55000,
      startDate: dayFromNow(10),
    });
    const endsAt = new Date(`${dayFromNow(10)}T00:00:00Z`);
    const sevenDaysBefore = new Date(endsAt.getTime() - 6.5 * DAY_MS);

    sentEmails.length = 0;
    const first = await sendLaunchOfferReminders(sevenDaysBefore);
    expect(first).toMatchObject({ stage: 7, sent: 2, failed: 0 });
    const byRecipient = new Map(sentEmails.map((e) => [e.to, e]));
    expect([...byRecipient.keys()].sort()).toEqual([
      "afi@example.test",
      "ama@example.test",
    ]);
    expect(byRecipient.get("afi@example.test")?.subject).toContain(
      "Plus que 7 jours",
    );
    expect(byRecipient.get("afi@example.test")?.html).toContain(
      "ta cagnotte garde le prix",
    );
    expect(byRecipient.get("ama@example.test")?.subject).toContain(
      "préviens tes contacts",
    );

    // Same day again: nothing new.
    expect(await sendLaunchOfferReminders(sevenDaysBefore)).toMatchObject({
      sent: 0,
    });

    // The last day: the final reminder.
    sentEmails.length = 0;
    const lastDay = new Date(endsAt.getTime() - 0.5 * DAY_MS);
    expect(await sendLaunchOfferReminders(lastDay)).toMatchObject({
      stage: 1,
      sent: 2,
    });
    expect(sentEmails[0].subject).toContain("Dernier jour");
  });
});
