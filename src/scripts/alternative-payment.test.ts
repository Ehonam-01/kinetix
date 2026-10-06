// A member who paid outside the site (the admin's shop link) and is then
// activated by an admin keeps their sponsor: the subscription the admin
// grants is attributed like a real payment, so the sponsor's
// first-subscription commission isn't lost. Plus the shop link's own
// validation. Disposable pglite database.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createSimulationDb,
  seedBaselineParameters,
} from "./simulation-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any;

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));

async function makeProfile(
  label: string,
  options: { role?: "ADMIN"; status?: "ACTIVE" | "PENDING_PAYMENT" } = {},
) {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `Membre ${label}`,
    status: options.status ?? "PENDING_PAYMENT",
    role: options.role ?? "USER",
  });
  return id;
}

describe("alternative payment", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("only accepts an https link, and an empty one removes it", async () => {
    const { normalizePaymentUrl } =
      await import("@/services/admin/update-alternative-payment-url");
    expect(
      normalizePaymentUrl(
        "  https://kinetix-e-learning.mymaketou.shop/products/x/checkout ",
      ),
    ).toBe("https://kinetix-e-learning.mymaketou.shop/products/x/checkout");
    expect(normalizePaymentUrl("")).toBeNull();
    expect(() => normalizePaymentUrl("http://exemple.com")).toThrow("https://");
    expect(() => normalizePaymentUrl("boutique maketou")).toThrow(
      "Lien invalide",
    );
  });

  it("an admin-granted subscription is attributed to the member's sponsor", async () => {
    const { grantSubscriptionCredit } =
      await import("@/services/subscriptions/grant-subscription-credit");
    const admin = await makeProfile("admin", {
      role: "ADMIN",
      status: "ACTIVE",
    });
    const sponsor = await makeProfile("parrain", { status: "ACTIVE" });
    await localDb.insert(schema.ambassadorProfiles).values({
      userId: sponsor,
      referralCode: `parrain_${sponsor.slice(0, 4)}`,
      termsAcceptedAt: new Date(),
      termsVersion: "test",
    });
    const member = await makeProfile("boutique");
    await localDb
      .insert(schema.sponsorships)
      .values({ userId: member, sponsorId: sponsor });

    await grantSubscriptionCredit(admin, member);

    const subscription = await localDb.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, member),
    });
    expect(subscription.ambassadorUserId).toBe(sponsor);
  });
});
