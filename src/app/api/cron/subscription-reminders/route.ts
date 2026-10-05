import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCronEnv } from "@/config/env.cron";
import { sendCommissionEmails } from "@/services/notifications/commission-emails";
import { sendLevelCompletedEmails } from "@/services/notifications/level-completed-emails";
import { sendExpiryReminders } from "@/services/subscriptions/send-expiry-reminders";
import { processInstallmentDeadlines } from "@/services/subscriptions/installments";

// Triggered by Vercel Cron (vercel.json) — Vercel automatically sends
// `Authorization: Bearer ${CRON_SECRET}` on every scheduled invocation once
// that env var is set, so this rejects any other caller (a stray public GET
// must never be able to trigger a mass email send). Constant-time
// comparison, same as every other secret check in this codebase.
export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${getCronEnv().CRON_SECRET}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendExpiryReminders();
  // Safety net for the "niveau complété" emails: normally sent right
  // after the level is completed, this catches any that failed or were
  // completed outside a request.
  const levelEmails = await sendLevelCompletedEmails();
  // Same safety net for the "nouveau filleul" commission emails.
  const commissionEmails = await sendCommissionEmails();
  // Installment plans: close the ones past their deadline (refund owed),
  // remind the ones close to it.
  const installments = await processInstallmentDeadlines();
  return NextResponse.json({
    ...result,
    levelEmails,
    commissionEmails,
    installments,
  });
}
