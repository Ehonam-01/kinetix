import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { courses, lessons, modules } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { quizQuestions, quizzes, type QuizOption } from "@/db/schema/quizzes";
import { getAnthropicEnv } from "@/config/env.anthropic";
import { slugify } from "@/lib/utils";
import { logAdminAction } from "@/services/admin/audit-log";

// Sonnet, not Opus — a course outline (structured text + article prose) is
// squarely in "well-balanced default" territory, not the kind of task that
// needs Opus-level reasoning to justify its cost/latency.
const MODEL = "claude-sonnet-5";

const optionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(optionSchema).min(2),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: "Chaque question doit avoir exactement une bonne réponse.",
  });

const quizSchema = z.object({
  passingScore: z.number().int().min(1).max(100),
  questions: z.array(questionSchema).min(1),
});

const lessonSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    lessonType: z.enum(["VIDEO", "TEXT"]),
    content: z.string().optional(),
    quiz: quizSchema.optional(),
  })
  .refine((l) => l.lessonType !== "TEXT" || !!l.content?.trim(), {
    message: "Une leçon de type TEXT doit avoir un contenu.",
  });

const moduleSchema = z.object({
  title: z.string().min(1),
  lessons: z.array(lessonSchema).min(1),
});

const generatedCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  modules: z.array(moduleSchema).min(1),
});

export type GeneratedCourse = z.infer<typeof generatedCourseSchema>;

// A tool definition, not a "reply in JSON" prompt — forces Claude's response
// into this exact shape instead of hoping a JSON.parse over prose works,
// and tool_choice below removes any chance it answers with prose instead.
const COURSE_TOOL = {
  name: "create_course_outline",
  description:
    "Crée le plan complet d'un cours en ligne : métadonnées, modules et leçons.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Titre du cours" },
      description: {
        type: "string",
        description: "Description courte du cours (1 à 2 phrases)",
      },
      category: { type: "string", description: "Catégorie du cours" },
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            lessons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  lessonType: { type: "string", enum: ["VIDEO", "TEXT"] },
                  content: {
                    type: "string",
                    description:
                      "Contenu complet de l'article en français, plusieurs paragraphes, pédagogique et concret — uniquement si lessonType=TEXT.",
                  },
                  quiz: {
                    type: "object",
                    description:
                      "Quiz de compréhension — uniquement pour une leçon lessonType=TEXT.",
                    properties: {
                      passingScore: {
                        type: "integer",
                        minimum: 1,
                        maximum: 100,
                      },
                      questions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            question: { type: "string" },
                            options: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  text: { type: "string" },
                                  isCorrect: { type: "boolean" },
                                },
                                required: ["text", "isCorrect"],
                              },
                              minItems: 2,
                            },
                          },
                          required: ["question", "options"],
                        },
                        minItems: 1,
                      },
                    },
                    required: ["passingScore", "questions"],
                  },
                },
                required: ["title", "lessonType"],
              },
              minItems: 1,
            },
          },
          required: ["title", "lessons"],
        },
        minItems: 1,
      },
    },
    required: ["title", "description", "category", "modules"],
  },
};

export type GenerateCourseInput = {
  topic: string;
  moduleCount: number;
  contentType: "VIDEO" | "TEXT" | "MIXED";
  level?: string;
};

// Only this function touches the network — persistGeneratedCourse below
// takes a plain GeneratedCourse object, so the DB-writing half is fully
// testable with a hand-built payload, without a real API key.
export async function callClaudeForCourseOutline(
  input: GenerateCourseInput,
): Promise<GeneratedCourse> {
  const client = new Anthropic({ apiKey: getAnthropicEnv().ANTHROPIC_API_KEY });

  const contentTypeInstruction =
    input.contentType === "VIDEO"
      ? "Toutes les leçons doivent être de type VIDEO (pas de contenu ni de quiz — la vidéo sera ajoutée manuellement ensuite)."
      : input.contentType === "TEXT"
        ? "Toutes les leçons doivent être de type TEXT, avec un contenu d'article complet et un quiz de compréhension de 2 à 4 questions."
        : "Mélange les leçons VIDEO et TEXT selon ce qui est le plus adapté à chaque sujet — les leçons TEXT ont un contenu d'article complet et un quiz de compréhension de 2 à 4 questions ; les leçons VIDEO n'ont ni contenu ni quiz.";

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system:
      "Tu conçois des plans de formation professionnels en français, pour une plateforme de cours en ligne. Contenu concret et pratique, sans promesses irréalistes (jamais de promesse de revenu ou d'enrichissement).",
    messages: [
      {
        role: "user",
        content: `Crée le plan complet d'un cours sur : "${input.topic}"${input.level ? ` (niveau : ${input.level})` : ""}. Le cours doit avoir environ ${input.moduleCount} modules. ${contentTypeInstruction}`,
      },
    ],
    tools: [COURSE_TOOL],
    tool_choice: { type: "tool", name: "create_course_outline" },
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas renvoyé de plan de cours exploitable.");
  }

  const parsed = generatedCourseSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `Le plan généré ne correspond pas au format attendu : ${parsed.error.issues[0]?.message ?? "erreur inconnue"}`,
    );
  }

  return parsed.data;
}

// Always creates a DRAFT course — an AI-generated plan must be reviewed by
// an admin (title, content, video placeholders) before it can reach
// learners, same reasoning as updateCourseStatus's own doc comment.
export async function persistGeneratedCourse(
  adminUserId: string,
  generated: GeneratedCourse,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut générer un cours.");
    }

    const [course] = await tx
      .insert(courses)
      .values({
        title: generated.title,
        slug: slugify(generated.title),
        description: generated.description,
        category: generated.category,
        status: "DRAFT",
        isActive: true,
      })
      .returning();

    let lessonCount = 0;
    for (const [moduleIndex, mod] of generated.modules.entries()) {
      const [dbModule] = await tx
        .insert(modules)
        .values({
          courseId: course.id,
          title: mod.title,
          position: moduleIndex + 1,
        })
        .returning();

      for (const [lessonIndex, lesson] of mod.lessons.entries()) {
        const [dbLesson] = await tx
          .insert(lessons)
          .values({
            moduleId: dbModule.id,
            title: lesson.title,
            description: lesson.description,
            lessonType: lesson.lessonType,
            content: lesson.lessonType === "TEXT" ? lesson.content : null,
            position: lessonIndex + 1,
          })
          .returning();
        lessonCount += 1;

        if (lesson.lessonType === "TEXT" && lesson.quiz) {
          const [quiz] = await tx
            .insert(quizzes)
            .values({
              lessonId: dbLesson.id,
              passingScore: lesson.quiz.passingScore,
            })
            .returning();

          await tx.insert(quizQuestions).values(
            lesson.quiz.questions.map((q, i) => ({
              quizId: quiz.id,
              question: q.question,
              position: i + 1,
              options: q.options.map((o): QuizOption => ({
                id: crypto.randomUUID(),
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            })),
          );
        }
      }
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_GENERATED_AI",
      targetType: "course",
      targetId: course.id,
      metadata: {
        title: generated.title,
        moduleCount: generated.modules.length,
        lessonCount,
      },
    });

    return course;
  });
}

export async function generateCourseWithAI(
  adminUserId: string,
  input: GenerateCourseInput,
) {
  const generated = await callClaudeForCourseOutline(input);
  return persistGeneratedCourse(adminUserId, generated);
}
