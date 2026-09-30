// Questions & answers under lessons, against a disposable pglite database
// (every real migration applied, nothing shared touched): who can post,
// no links for members, the answer email, author badges, reports hiding a
// post after 3, and the admin's moderation.
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
const sentEmails: { to: string; subject: string; html: string }[] = [];
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: {
    sendEmail: async (input: { to: string; subject: string; html: string }) => {
      sentEmails.push(input);
    },
  },
}));

const DAY_MS = 24 * 60 * 60 * 1000;

async function makeMember(
  label: string,
  options: { subscribed?: boolean; role?: "ADMIN" } = {},
) {
  const id = randomUUID();
  const email = `${label}@example.test`;
  await localClient.query(
    'INSERT INTO "auth"."users" (id, email) VALUES ($1, $2);',
    [id, email],
  );
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `Membre ${label}`,
    status: "ACTIVE",
    role: options.role ?? "USER",
  });
  if (options.subscribed) {
    const [payment] = await localDb
      .insert(schema.payments)
      .values({
        beneficiaryUserId: id,
        purpose: "SUBSCRIPTION",
        method: "ADMIN_CREDIT",
        amount: 15000,
        status: "CONFIRMED",
        idempotencyKey: `TEST:${randomUUID()}`,
      })
      .returning();
    await localDb.insert(schema.subscriptions).values({
      userId: id,
      paymentId: payment.id,
      expiresAt: new Date(Date.now() + 100 * DAY_MS),
      pricePaid: 15000,
      businessVolume: 15,
    });
  }
  return { id, email };
}

async function makeLesson(status: "PUBLISHED" | "DRAFT" = "PUBLISHED") {
  const [course] = await localDb
    .insert(schema.courses)
    .values({ title: `Formation ${status}`, status })
    .returning();
  const [mod] = await localDb
    .insert(schema.modules)
    .values({ courseId: course.id, title: "Module", position: 1 })
    .returning();
  const [lesson] = await localDb
    .insert(schema.lessons)
    .values({
      moduleId: mod.id,
      title: "Fixer ses prix",
      lessonType: "TEXT",
      position: 1,
    })
    .returning();
  return lesson.id as string;
}

describe("lesson questions & answers (pglite, no shared DB touched)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    await seedBaselineParameters(db);
  }, 120_000);

  it("runs a question/answer thread with access rules, badges and the answer email", async () => {
    const lms = await import("@/services/lms/lesson-discussion");
    const { listLessonDiscussion, listUnansweredLessonQuestions } =
      await import("@/repositories/lesson-discussions");
    const lessonId = await makeLesson();
    const asker = await makeMember("asker", { subscribed: true });
    const outsider = await makeMember("outsider");
    const admin = await makeMember("admin", { role: "ADMIN" });
    const mentor = await makeMember("mentor", { subscribed: true });
    await localDb.insert(schema.mentorProfiles).values({
      userId: mentor.id,
      category: "Business",
      status: "APPROVED",
    });

    // No subscription, no posting.
    await expect(
      lms.postLessonQuestion(outsider.id, lessonId, "Comment faire ?"),
    ).rejects.toThrow("pas accès");
    // Members can't post links; the team can.
    await expect(
      lms.postLessonQuestion(
        asker.id,
        lessonId,
        "Voir https://arnaque.example",
      ),
    ).rejects.toThrow("liens ne sont pas autorisés");

    const question = await lms.postLessonQuestion(
      asker.id,
      lessonId,
      "Comment calculer ma marge ?",
    );
    expect(
      (await listUnansweredLessonQuestions(localDb)).map(
        (p: { id: string }) => p.id,
      ),
    ).toContain(question.id);

    await lms.postLessonAnswer(
      admin.id,
      question.id,
      "Prix de vente moins coûts, voir www.kinetix-africa.com",
    );
    await lms.postLessonAnswer(
      mentor.id,
      question.id,
      "Commence par tes coûts fixes.",
    );

    const answerMails = sentEmails.filter((m) => m.to === asker.email);
    expect(answerMails).toHaveLength(2);
    expect(answerMails[0].subject).toBe("Nouvelle réponse à votre question");

    const thread = await listLessonDiscussion(localDb, lessonId, asker.id);
    expect(thread).toHaveLength(1);
    expect(thread[0].isMine).toBe(true);
    expect(thread[0].answers.map((a) => a.authorBadge)).toEqual([
      "TEAM",
      "MENTOR",
    ]);
    expect(
      (await listUnansweredLessonQuestions(localDb)).map(
        (p: { id: string }) => p.id,
      ),
    ).not.toContain(question.id);
  });

  it("hides a post after 3 reports, and lets the admin restore it", async () => {
    const lms = await import("@/services/lms/lesson-discussion");
    const { listLessonDiscussion, listReportedLessonPosts } =
      await import("@/repositories/lesson-discussions");
    const lessonId = await makeLesson();
    const author = await makeMember("spammer", { subscribed: true });
    const admin = await makeMember("admin2", { role: "ADMIN" });
    const reporters = await Promise.all(
      ["r1", "r2", "r3"].map((l) => makeMember(l, { subscribed: true })),
    );
    const post = await lms.postLessonQuestion(
      author.id,
      lessonId,
      "Rejoignez mon équipe, gains garantis !",
    );

    await expect(lms.reportLessonPost(author.id, post.id)).rejects.toThrow(
      "propre message",
    );
    await lms.reportLessonPost(reporters[0].id, post.id, "recrutement");
    await lms.reportLessonPost(reporters[0].id, post.id); // counted once
    await lms.reportLessonPost(reporters[1].id, post.id);
    expect(
      await listLessonDiscussion(localDb, lessonId, admin.id),
    ).toHaveLength(1);
    await lms.reportLessonPost(reporters[2].id, post.id);
    expect(
      await listLessonDiscussion(localDb, lessonId, admin.id),
    ).toHaveLength(0);

    const queue = await listReportedLessonPosts(localDb);
    const queued = queue.find((p: { id: string }) => p.id === post.id);
    expect(queued).toMatchObject({ hiddenReason: "REPORTS", openReports: 3 });
    expect(queued?.reportReasons).toEqual(["recrutement"]);

    await lms.adminRestoreLessonPost(admin.id, post.id);
    expect(
      await listLessonDiscussion(localDb, lessonId, admin.id),
    ).toHaveLength(1);
    expect(
      (await listReportedLessonPosts(localDb)).some(
        (p: { id: string }) => p.id === post.id,
      ),
    ).toBe(false);
  });

  it("lets an author delete their own post, which an admin can't bring back", async () => {
    const lms = await import("@/services/lms/lesson-discussion");
    const lessonId = await makeLesson();
    const author = await makeMember("author", { subscribed: true });
    const other = await makeMember("other", { subscribed: true });
    const admin = await makeMember("admin3", { role: "ADMIN" });
    const post = await lms.postLessonQuestion(
      author.id,
      lessonId,
      "Ma question",
    );

    await expect(lms.deleteOwnLessonPost(other.id, post.id)).rejects.toThrow(
      "n'existe plus",
    );
    await lms.deleteOwnLessonPost(author.id, post.id);
    const row = await localDb.query.lessonPosts.findFirst({
      where: eq(schema.lessonPosts.id, post.id),
    });
    expect(row.hiddenReason).toBe("AUTHOR");
    await expect(lms.adminRestoreLessonPost(admin.id, post.id)).rejects.toThrow(
      "supprimé par son auteur",
    );
  });

  it("gives no access to a draft course's lessons", async () => {
    const lms = await import("@/services/lms/lesson-discussion");
    const lessonId = await makeLesson("DRAFT");
    const member = await makeMember("drafty", { subscribed: true });
    await expect(
      lms.postLessonQuestion(member.id, lessonId, "Une question ?"),
    ).rejects.toThrow("pas accès");
  });
});
