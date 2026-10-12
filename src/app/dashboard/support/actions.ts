"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newTicketSchema, ticketMessageSchema } from "@/schemas/support";
import { requireUser } from "@/services/auth/current-user";
import {
  addMemberMessage,
  closeTicketByMember,
  createTicket,
} from "@/services/support/support-tickets";

const failure = (err: unknown) => ({
  error: err instanceof Error ? err.message : "Une erreur est survenue.",
});

// requireUser, not requireActiveMember: a suspended member must still be
// able to reach the team.
export async function createTicketAction(input: unknown) {
  const { profile } = await requireUser();
  const parsed = newTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  let ticketId: string;
  try {
    ticketId = (await createTicket(profile.id, parsed.data)).id;
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/support");
  redirect(`/dashboard/support/${ticketId}`);
}

export async function replyToTicketAction(ticketId: string, body: string) {
  const { profile } = await requireUser();
  const parsed = ticketMessageSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  try {
    await addMemberMessage(profile.id, ticketId, parsed.data.body);
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { error: null };
}

export async function closeTicketAction(ticketId: string) {
  const { profile } = await requireUser();
  try {
    await closeTicketByMember(profile.id, ticketId);
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { error: null };
}
