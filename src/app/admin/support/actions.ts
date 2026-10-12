"use server";

import { revalidatePath } from "next/cache";
import { ticketMessageSchema } from "@/schemas/support";
import { requireAdmin } from "@/services/auth/current-user";
import {
  addStaffReply,
  setTicketStatusByAdmin,
} from "@/services/support/support-tickets";

const failure = (err: unknown) => ({
  error: err instanceof Error ? err.message : "Une erreur est survenue.",
});

function revalidateTicket(ticketId: string) {
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath(`/dashboard/support/${ticketId}`);
}

export async function replyAsStaffAction(
  ticketId: string,
  close: boolean,
  body: string,
) {
  const { profile } = await requireAdmin();
  const parsed = ticketMessageSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  try {
    await addStaffReply(profile.id, ticketId, parsed.data.body, { close });
  } catch (err) {
    return failure(err);
  }
  revalidateTicket(ticketId);
  return { error: null };
}

export async function setTicketStatusAction(
  ticketId: string,
  status: "OPEN" | "CLOSED",
) {
  const { profile } = await requireAdmin();
  try {
    await setTicketStatusByAdmin(profile.id, ticketId, status);
  } catch (err) {
    return failure(err);
  }
  revalidateTicket(ticketId);
  return { error: null };
}
