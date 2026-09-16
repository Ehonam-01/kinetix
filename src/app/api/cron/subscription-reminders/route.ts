import { NextResponse } from "next/server";
import { getCronEnv } from "@/config/env.cron";
import { sendExpiryReminders } from "@/services/subscriptions/send-expiry-reminders";

// Triggered by Vercel Cron (vercel.json) — Vercel automatically sends
// `Authorization: Bearer ${CRON_SECRET}` on every scheduled invocation once
// that env var is set, so this rejects any other caller (a stray public GET
// must never be able to trigger a mass email send).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${getCronEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendExpiryReminders();
  return NextResponse.json(result);
}
