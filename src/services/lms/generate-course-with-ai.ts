import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { courses, lessons, modules } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { quizQuestions, quizzes, type QuizOption } from "@/db/schema/quizzes";
import { getAnthropicEnv } from "@/config/env.anthropic";
import { findAvailableSlug } from "@/repositories/courses";
import { logAdminAction } from "@/services/admin/audit-log";
import {
  assertMaxLength,
  LESSON_CONTENT_MAX,
  LONG_TEXT_MAX,
  SHORT_TEXT_MAX,
} from "@/services/admin/input-limits";

// Sonnet, not Opus — a course outline (structured text + article prose) is
// squarely in "well-balanced default" territory, not the kind of task that
// needs Opus-level reasoning to justify its cost/latency.
const MODEL = "claude-sonnet-5";

const optionSchema = z.object({
  text: z.string().min(1).max(SHORT_TEXT_MAX),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    question: z.string().min(1).max(LONG_TEXT_MAX),
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
    title: z.string().min(1).max(SHORT_TEXT_MAX),
    description: z.string().max(LONG_TEXT_MAX).optional(),
    lessonType: z.enum(["VIDEO", "TEXT"]),
    content: z.string().max(LESSON_CONTENT_MAX).optional(),
    estimatedMinutes: z.number().int().min(1).max(240).optional(),
    quiz: quizSchema.optional(),
  })
  .refine((l) => l.lessonType !== "TEXT" || !!l.content?.trim(), {
    message: "Une leçon de type TEXT doit avoir un contenu.",
  });

const moduleSchema = z.object({
  title: z.string().min(1).max(SHORT_TEXT_MAX),
  lessons: z.array(lessonSchema).min(1),
});

// Bounded like the admin forms (services/admin/input-limits.ts): this
// output is inserted directly, not through createCourse/createLesson.
const generatedCourseSchema = z.object({
  title: z.string().min(1).max(SHORT_TEXT_MAX),
  description: z.string().min(1).max(LONG_TEXT_MAX),
  category: z.string().min(1).max(SHORT_TEXT_MAX),
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
                      "Uniquement si lessonType=TEXT : l'article complet en Markdown (voir les consignes de rédaction).",
                  },
                  estimatedMinutes: {
                    type: "integer",
                    minimum: 1,
                    maximum: 240,
                    description:
                      "Durée estimée de la leçon en minutes (lecture + quiz, ou durée de vidéo visée).",
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

// How a TEXT lesson must be written — rendered by components/lesson-
// content.tsx (react-markdown + GFM), so every element listed here has a
// matching style on the learner side.
const WRITING_GUIDE = `Consignes de rédaction des articles (leçons TEXT) :
- Écris en Markdown : sections avec des titres "## ", sous-parties "### " si besoin, jamais de titre "# ".
- Commence par 1 à 2 phrases d'introduction qui disent ce que l'apprenant saura faire à la fin.
- Paragraphes courts (2 à 4 phrases), listes à puces ou numérotées pour les étapes, **gras** pour les notions clés.
- Au moins un exemple concret, ancré dans le contexte d'Afrique francophone (prix en FCFA, mobile money, WhatsApp, marchés locaux) quand c'est pertinent.
- Un encadré "> **Astuce :** …" ou "> **Attention :** …" pour le conseil le plus important.
- Un tableau Markdown seulement s'il compare vraiment plusieurs options.
- Termine par une section "## À retenir" de 3 à 5 puces.
- Environ 500 à 900 mots par article. Pas de HTML, pas d'images, pas de liens inventés.
- N'invente jamais de chiffres, de statistiques ou de témoignages présentés comme réels.`;

// Room for a full course of articles. Streamed (below): a non-streamed call
// this large is refused by the SDK, and streaming keeps the connection alive.
const MAX_TOKENS = 20_000;

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

  const message = await client.messages
    .stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: `Tu conçois des formations professionnelles en français, pour une plateforme de cours en ligne destinée à un public d'Afrique francophone. Contenu concret et pratique, sans promesses irréalistes (jamais de promesse de revenu ou d'enrichissement).

${WRITING_GUIDE}`,
      messages: [
        {
          role: "user",
          content: `Crée le plan complet d'un cours sur : "${input.topic}"${input.level ? ` (niveau : ${input.level})` : ""}. Le cours doit avoir environ ${input.moduleCount} modules. ${contentTypeInstruction}`,
        },
      ],
      tools: [COURSE_TOOL],
      tool_choice: { type: "tool", name: "create_course_outline" },
    })
    .finalMessage();

  // Cut off mid-answer: the plan is incomplete, whatever the parser says.
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "La formation demandée est trop longue pour être générée d'un coup. Réessaie avec moins de modules.",
    );
  }

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
        slug: await findAvailableSlug(tx, generated.title),
        description: generated.description,
        category: generated.category,
        // Sum of the lessons' estimates, when Claude gave them.
        durationMinutes:
          generated.modules
            .flatMap((m) => m.lessons)
            .reduce((total, l) => total + (l.estimatedMinutes ?? 0), 0) || null,
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
  // Checked before the (paid) Anthropic call — the generated output is
  // bounded separately, by generatedCourseSchema above.
  assertMaxLength(input.topic, LONG_TEXT_MAX, "Sujet");
  assertMaxLength(input.level, SHORT_TEXT_MAX, "Niveau");
  if (
    !Number.isInteger(input.moduleCount) ||
    input.moduleCount < 1 ||
    input.moduleCount > 10
  ) {
    throw new Error("Le nombre de modules doit être compris entre 1 et 10.");
  }
  const generated = await callClaudeForCourseOutline(input);
  return persistGeneratedCourse(adminUserId, generated);
}
