import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { lessons } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { quizQuestions, quizzes, type QuizOption } from "@/db/schema/quizzes";
import { logAdminAction } from "@/services/admin/audit-log";

export type QuizQuestionInput = {
  question: string;
  options: { text: string; isCorrect: boolean }[];
};

// Full-replace on every save rather than per-question CRUD — an admin (or
// the AI generator, later) submits the whole quiz at once, and the delete
// + reinsert stays simple since nothing else references a question row by
// id: a quiz_attempts row is a self-contained snapshot (questionId ->
// selected option id) taken at submission time, so an edit here never
// corrupts past attempts, it just stops being what a *future* attempt is
// scored against.
export async function saveQuiz(
  adminUserId: string,
  lessonId: string,
  input: { passingScore: number; questions: QuizQuestionInput[] },
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un quiz.");
    }

    const lesson = await tx.query.lessons.findFirst({
      where: eq(lessons.id, lessonId),
    });
    if (!lesson || lesson.lessonType !== "TEXT") {
      throw new Error("Seule une leçon texte peut avoir un quiz.");
    }

    if (input.passingScore < 1 || input.passingScore > 100) {
      throw new Error("Le seuil de réussite doit être entre 1 et 100.");
    }
    for (const q of input.questions) {
      if (q.options.length < 2) {
        throw new Error(`« ${q.question} » a besoin d'au moins 2 options.`);
      }
      if (q.options.filter((o) => o.isCorrect).length !== 1) {
        throw new Error(
          `« ${q.question} » doit avoir exactement une bonne réponse.`,
        );
      }
    }

    let quiz = await tx.query.quizzes.findFirst({
      where: eq(quizzes.lessonId, lessonId),
    });
    if (quiz) {
      [quiz] = await tx
        .update(quizzes)
        .set({ passingScore: input.passingScore })
        .where(eq(quizzes.id, quiz.id))
        .returning();
    } else {
      [quiz] = await tx
        .insert(quizzes)
        .values({ lessonId, passingScore: input.passingScore })
        .returning();
    }

    await tx.delete(quizQuestions).where(eq(quizQuestions.quizId, quiz!.id));

    if (input.questions.length > 0) {
      await tx.insert(quizQuestions).values(
        input.questions.map((q, i) => ({
          quizId: quiz!.id,
          question: q.question,
          position: i + 1,
          options: q.options.map((o) => ({
            id: crypto.randomUUID(),
            text: o.text,
            isCorrect: o.isCorrect,
          })) satisfies QuizOption[],
        })),
      );
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "QUIZ_SAVED",
      targetType: "quiz",
      targetId: quiz!.id,
      metadata: { lessonId, questionCount: input.questions.length },
    });

    return quiz;
  });
}
