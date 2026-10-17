// Campaign tracking (Admin → Marketing), against a disposable pglite
// database with every real migration applied: a campaign arrival is
// recorded and the browser keeps its first one; that visit is credited to
// the sign-up; the report counts visitors, sign-ups, paying members and
// revenue per campaign, with untracked sign-ups as "direct".
import { randomUUID } from "node:crypto";
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

const HOST = "www.kinetix-africa.com";

async function makeMember(label: string, role: "USER" | "ADMIN" = "USER") {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `${label} Test`,
    status: "ACTIVE",
    role,
  });
  return id;
}

async function pay(userId: string, amount: number) {
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: userId,
      purpose: "SUBSCRIPTION",
      method: "MOBILE_MONEY",
      amount,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.subscriptions).values({
    userId,
    paymentId: payment.id,
    expiresAt: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
    pricePaid: amount,
    businessVolume: 15,
  });
}

describe("campaign tracking (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
  }, 120_000);

  it("only records arrivals from a campaign or another site", async () => {
    const { recordMarketingVisit, referrerHostOf } =
      await import("@/services/marketing/campaign-tracking");
    expect(referrerHostOf("https://m.facebook.com/x", HOST)).toBe(
      "m.facebook.com",
    );
    expect(referrerHostOf(`https://${HOST}/formations`, HOST)).toBeNull();
    expect(referrerHostOf("https://kinetix-africa.com/", HOST)).toBeNull();

    // Direct visit: nothing recorded, no cookie.
    expect(
      await recordMarketingVisit({ landingPath: "/" }, HOST, undefined),
    ).toBeNull();
  });

  it("keeps the first campaign of a browser and credits it to the sign-up", async () => {
    const { recordMarketingVisit, parseMarketingCookie, attachSignupSource } =
      await import("@/services/marketing/campaign-tracking");

    const cookie = await recordMarketingVisit(
      {
        utmSource: "Facebook",
        utmCampaign: "lancement-octobre",
        landingPath: "/",
      },
      HOST,
      undefined,
    );
    expect(cookie).toBeTruthy();
    const parsed = parseMarketingCookie(cookie!);
    expect(parsed).not.toBeNull();

    // A later arrival from another campaign: recorded, cookie unchanged.
    expect(
      await recordMarketingVisit(
        { utmSource: "tiktok", utmCampaign: "autre", landingPath: "/" },
        HOST,
        cookie!,
      ),
    ).toBeNull();

    const member = await makeMember("afi");
    await attachSignupSource(localDb, member, parsed!.firstVisitId);
    // A forged or unknown id is ignored.
    await attachSignupSource(localDb, await makeMember("x"), randomUUID());
    await attachSignupSource(localDb, await makeMember("y"), "pas-un-id");

    const sources = await localDb.select().from(schema.signupSources);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      userId: member,
      utmSource: "facebook",
      utmCampaign: "lancement-octobre",
    });
  });

  it("reports visitors, sign-ups, paying members and revenue per campaign", async () => {
    const {
      recordMarketingVisit,
      parseMarketingCookie,
      attachSignupSource,
      getCampaignReport,
    } = await import("@/services/marketing/campaign-tracking");

    // Two more visitors from the October campaign; one signs up and pays.
    const c1 = await recordMarketingVisit(
      {
        utmSource: "facebook",
        utmCampaign: "lancement-octobre",
        landingPath: "/",
      },
      HOST,
      undefined,
    );
    await recordMarketingVisit(
      {
        utmSource: "facebook",
        utmCampaign: "lancement-octobre",
        landingPath: "/",
      },
      HOST,
      undefined,
    );
    const payer = await makeMember("kofi");
    await attachSignupSource(
      localDb,
      payer,
      parseMarketingCookie(c1!)!.firstVisitId,
    );
    await pay(payer, 19500);

    const report = await getCampaignReport(30);
    const october = report.find(
      (r) => r.source === "facebook" && r.campaign === "lancement-octobre",
    );
    expect(october).toMatchObject({
      visitors: 3,
      signups: 2,
      paid: 1,
      revenue: 19500,
    });
    // Sign-ups with no campaign recorded.
    expect(report.find((r) => r.source === "direct")?.signups).toBe(2);
    // The paying campaign comes first.
    expect(report[0]).toBe(october);
  });

  it("only accepts a pixel id made of digits, from an admin", async () => {
    const { updateMetaPixelId, getMetaPixelId } =
      await import("@/services/marketing/campaign-tracking");
    const admin = await makeMember("admin", "ADMIN");
    const member = await makeMember("ama");

    await expect(updateMetaPixelId(admin, "abc")).rejects.toThrow(
      "Identifiant invalide",
    );
    await expect(updateMetaPixelId(member, "1234567890123456")).rejects.toThrow(
      "Seul un administrateur",
    );

    await updateMetaPixelId(admin, " 1234 5678 9012 3456 ");
    expect(await getMetaPixelId(localDb)).toBe("1234567890123456");
    await updateMetaPixelId(admin, "");
    expect(await getMetaPixelId(localDb)).toBeNull();
  });
});
