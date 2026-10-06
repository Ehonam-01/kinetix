import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const paymentProviderEnum = pgEnum("payment_provider", [
  "MONEROO",
  "BICTORYS",
  "PAYDUNYA",
]);

// Singleton row (fixed id "default") holding which PaymentProvider
// (services/payments/provider.ts) handles new inbound charges — read by
// services/payments/provider-selector.ts, written only by
// services/admin/update-payment-provider.ts. Deliberately NOT a
// parameter_versions row: that table exists for retroactive-safe financial
// amounts that commission_events snapshot (section 29/43, MLM_RULES.md);
// this is an operational on/off switch with no history a past record needs
// to stay pinned to, so a plain in-place update is correct here, unlike
// there.
export const paymentSettings = pgTable("payment_settings", {
  id: text("id").primaryKey().default("default"),
  activeProvider: paymentProviderEnum("active_provider")
    .notNull()
    .default("MONEROO"),
  // Support WhatsApp number, international format digits only (e.g.
  // 22890000000), shown to members whose country isn't in a payment or
  // withdrawal list. null = not set, nothing shown.
  supportWhatsapp: text("support_whatsapp"),
  // An outside payment page (e.g. a Maketou shop) for members whose means
  // of payment isn't offered: paid there, the account is then activated by
  // an admin ("Accorder un abonnement"). null = not shown.
  alternativePaymentUrl: text("alternative_payment_url"),
  // "Autre pays / carte bancaire" (SasPay's hosted checkout) offered next
  // to the active provider — switched on and off by the admin, and only
  // ever shown when SASPAY_SECRET_KEY is configured too.
  saspayEnabled: boolean("saspay_enabled").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
