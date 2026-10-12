import "server-only";
import type { Executor } from "@/db/executor";
import {
  getCurrentParameterValue,
  getCurrentParameterValueOrNull,
  getScheduledParameterVersion,
} from "@/repositories/parameter-versions";

export const PRICE_KEY = "subscription.price_in_cfa";
export const REGULAR_PRICE_KEY = "subscription.regular_price_in_cfa";

export type LaunchOffer = {
  // What a member pays today.
  price: number;
  // The price announced after the launch (shown struck through), or null
  // when there's no launch offer.
  nextPrice: number | null;
  // When the launch price ends (ISO), or null when no date is programmed —
  // the end of the offer is then only announced, without a countdown.
  endsAt: string | null;
  // nextPrice - price.
  savings: number | null;
};

// The launch offer as every page shows it. With a price change programmed
// by the admin (admin → Paramètres → Fin du prix de lancement), the end
// date and the new price come from that programmed version — the very one
// getCurrentParameterValue switches to on that date, so what's announced is
// exactly what happens. Otherwise, the "tarif normal" parameter alone.
export async function getLaunchOffer(executor: Executor): Promise<LaunchOffer> {
  const [price, regularPrice, scheduled] = await Promise.all([
    getCurrentParameterValue(executor, PRICE_KEY),
    getCurrentParameterValueOrNull(executor, REGULAR_PRICE_KEY),
    getScheduledParameterVersion(executor, PRICE_KEY),
  ]);
  if (scheduled && scheduled.value > price) {
    return {
      price,
      nextPrice: scheduled.value,
      endsAt: scheduled.effectiveFrom.toISOString(),
      savings: scheduled.value - price,
    };
  }
  if (regularPrice !== null && regularPrice > price) {
    return {
      price,
      nextPrice: regularPrice,
      endsAt: null,
      savings: regularPrice - price,
    };
  }
  return { price, nextPrice: null, endsAt: null, savings: null };
}

// "30 novembre 2026": the last day at the launch price — the day before the
// new price starts (at midnight GMT).
export function lastLaunchDayLabel(endsAt: string) {
  return new Date(new Date(endsAt).getTime() - 1).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
