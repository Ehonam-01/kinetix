"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { deleteTestSubscription } from "@/services/admin/delete-test-subscription";
import { db } from "@/db/client";
import { listMembersInGracePeriod } from "@/repositories/subscriptions";
import { sendGraceReminder } from "@/services/subscriptions/send-grace-reminder";

export async function deleteTestSubscriptionAction(subscriptionId: string) {
  const { profile } = await requireAdmin();
  try {
    await deleteTestSubscription(profile.id, subscriptionId);
    revalidatePath("/admin/subscriptions");
    // Both read subscriptions.pricePaid directly, so a deleted test row
    // must stop skewing them immediately, not just this list.
    revalidatePath("/admin");
    revalidatePath("/admin/audit-logs");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function sendGraceReminderAction(userId: string) {
  const { profile } = await requireAdmin();
  try {
    await sendGraceReminder(profile.id, userId);
    revalidatePath("/admin/subscriptions");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

// Every member currently in their grace period, one after the other. A
// member reminded less than an hour ago is skipped, not counted as a
// failure.
export async function sendAllGraceRemindersAction() {
  const { profile } = await requireAdmin();
  const members = await listMembersInGracePeriod(db);
  let sent = 0;
  let failed = 0;
  for (const member of members) {
    try {
      await sendGraceReminder(profile.id, member.userId);
      sent += 1;
    } catch (err) {
      if (!(
        err instanceof Error && err.message.includes("moins d'une heure")
      )) {
        failed += 1;
      }
    }
  }
  revalidatePath("/admin/subscriptions");
  return { sent, failed };
}
