// Support tickets, against a disposable pglite database with every real
// migration applied: a member opens a ticket, the team replies (the member
// sees it as new and gets an email), the member answers back (the ticket
// returns to the team), closes it, and reopens it by writing again. A
// member can't read or write on someone else's ticket, can't hold more
// than MAX_OPEN_TICKETS open ones, and only an admin can reply as staff.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { MAX_OPEN_TICKETS } from "@/config/support";
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

async function makeProfile(label: string, role: "USER" | "ADMIN" = "USER") {
  const id = randomUUID();
  await localClient.query(
    'INSERT INTO "auth"."users" (id, email) VALUES ($1, $2);',
    [id, `${label}@example.test`],
  );
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `Membre ${label}`,
    status: "ACTIVE",
    role,
  });
  return id;
}

const ticketInput = (subject = "Mon paiement n'apparaît pas") => ({
  category: "abonnement",
  subject,
  message: "J'ai payé hier par mobile money mais rien ne s'affiche.",
});

describe("support tickets (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
  }, 120_000);

  it("runs a full conversation between a member and the team", async () => {
    const svc = await import("@/services/support/support-tickets");
    const { sendMemberReplyEmail, sendStaffTicketEmail } =
      await import("@/services/notifications/support-emails");
    const member = await makeProfile("kofi");
    const admin = await makeProfile("admin", "ADMIN");

    const ticket = await svc.createTicket(member, ticketInput());
    expect(ticket.status).toBe("OPEN");
    expect(ticket.number).toBeGreaterThanOrEqual(1001);
    expect(await svc.listTicketsForAdmin("OPEN")).toHaveLength(1);

    await sendStaffTicketEmail(ticket.id, "NEW");
    expect(sentEmails.at(-1)?.to).toBe("admin@example.test");
    expect(sentEmails.at(-1)?.subject).toContain(`#${ticket.number}`);

    await svc.addStaffReply(
      admin,
      ticket.id,
      "Bonjour, nous vérifions ton paiement.",
    );
    let [listed] = await svc.listTicketsForMember(member);
    expect(listed.status).toBe("ANSWERED");
    expect(listed.hasNewReply).toBe(true);
    expect(await svc.countTicketsWithNewReply(member)).toBe(1);

    await sendMemberReplyEmail(ticket.id);
    expect(sentEmails.at(-1)?.to).toBe("kofi@example.test");
    expect(sentEmails.at(-1)?.html).toContain("nous vérifions ton paiement");

    // Opening the ticket marks the reply as read.
    const opened = await svc.openTicketForMember(member, ticket.id);
    expect(opened?.messages.map((m) => m.fromStaff)).toEqual([false, true]);
    expect(await svc.countTicketsWithNewReply(member)).toBe(0);

    await svc.addMemberMessage(
      member,
      ticket.id,
      "Merci, voici la référence : TX123456.",
    );
    [listed] = await svc.listTicketsForMember(member);
    expect(listed.status).toBe("OPEN");

    await svc.addStaffReply(
      admin,
      ticket.id,
      "C'est réglé, ton abonnement est actif.",
      {
        close: true,
      },
    );
    [listed] = await svc.listTicketsForMember(member);
    expect(listed.status).toBe("CLOSED");

    // Writing on a closed ticket reopens it for the team.
    await svc.addMemberMessage(
      member,
      ticket.id,
      "Encore une petite question svp.",
    );
    [listed] = await svc.listTicketsForMember(member);
    expect(listed.status).toBe("OPEN");
    expect(listed.closedAt).toBeNull();
  });

  it("keeps each member to their own tickets", async () => {
    const svc = await import("@/services/support/support-tickets");
    const owner = await makeProfile("ama");
    const other = await makeProfile("yao");
    const ticket = await svc.createTicket(owner, ticketInput());

    expect(await svc.openTicketForMember(other, ticket.id)).toBeNull();
    await expect(
      svc.addMemberMessage(
        other,
        ticket.id,
        "Je réponds sur le ticket d'un autre.",
      ),
    ).rejects.toThrow("Ticket introuvable.");
    await expect(svc.closeTicketByMember(other, ticket.id)).rejects.toThrow(
      "Ticket introuvable.",
    );
    await expect(
      svc.addStaffReply(other, ticket.id, "Je ne suis pas administrateur."),
    ).rejects.toThrow("Seul un administrateur");
    expect(await svc.openTicketForMember(owner, "pas-un-uuid")).toBeNull();
  });

  it(`caps a member at ${MAX_OPEN_TICKETS} open tickets`, async () => {
    const svc = await import("@/services/support/support-tickets");
    const member = await makeProfile("esi");
    const tickets = [];
    for (let i = 0; i < MAX_OPEN_TICKETS; i++) {
      tickets.push(
        await svc.createTicket(member, ticketInput(`Question ${i + 1}`)),
      );
    }
    await expect(
      svc.createTicket(member, ticketInput("Une de trop")),
    ).rejects.toThrow("tickets en cours");
    await svc.closeTicketByMember(member, tickets[0].id);
    await expect(
      svc.createTicket(member, ticketInput("Après fermeture")),
    ).resolves.toMatchObject({ status: "OPEN" });
  });
});
