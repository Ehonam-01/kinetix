// The AI course generator against a disposable pglite database (every real
// migration applied, nothing shared touched). Anthropic's API is faked —
// the test decides what "Claude" answers — so no key or network is needed:
// the prompt asks for Markdown, a cut-off answer gives a clear error, the
// lesson estimates become the course duration, and the course is a draft.
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

// What the fake Claude answers next, and what it was asked.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nextAnswer: { stop_reason: string; input: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requests: any[] = [];
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stream: (params: any) => {
        requests.push(params);
        return {
          finalMessage: async () => ({
            stop_reason: nextAnswer.stop_reason,
            content: [
              {
                type: "tool_use",
                name: "create_course_outline",
                input: nextAnswer.input,
              },
            ],
          }),
        };
      },
    };
  },
}));

const ARTICLE =
  "Tu sauras fixer un prix.\n\n## Les coûts\n\n- Matière\n- Temps\n\n> **Astuce :** compte ton temps.\n\n## À retenir\n\n- Un prix couvre les coûts";

const OUTLINE = {
  title: "Fixer ses prix",
  description: "Apprendre à fixer un prix rentable.",
  category: "Entrepreneuriat",
  modules: [
    {
      title: "Les bases",
      lessons: [
        {
          title: "Calculer ses coûts",
          lessonType: "TEXT",
          content: ARTICLE,
          estimatedMinutes: 12,
          quiz: {
            passingScore: 100,
            questions: [
              {
                question: "Un prix doit couvrir…",
                options: [
                  { text: "les coûts", isCorrect: true },
                  { text: "rien", isCorrect: false },
                ],
              },
            ],
          },
        },
        {
          title: "Vidéo d'introduction",
          lessonType: "VIDEO",
          estimatedMinutes: 8,
        },
      ],
    },
  ],
};

describe("AI course generation (pglite, fake Anthropic API)", () => {
  let admin: string;

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = "test_unit_test_fake_key";
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
    admin = randomUUID();
    await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [
      admin,
    ]);
    await localDb.insert(schema.profiles).values({
      id: admin,
      username: `admin_${admin.slice(0, 6)}`,
      fullName: "Admin",
      status: "ACTIVE",
      role: "ADMIN",
    });
  }, 120_000);

  it("asks for Markdown and saves a draft with the summed duration", async () => {
    const { generateCourseWithAI } =
      await import("@/services/lms/generate-course-with-ai");
    nextAnswer = { stop_reason: "tool_use", input: OUTLINE };

    const course = await generateCourseWithAI(admin, {
      topic: "Fixer ses prix",
      moduleCount: 1,
      contentType: "MIXED",
    });

    const request = requests.at(-1);
    expect(request.system).toContain("Markdown");
    expect(request.system).toContain("## À retenir");
    expect(request.max_tokens).toBeGreaterThan(8000);

    const saved = await localDb.query.courses.findFirst({
      where: eq(schema.courses.id, course.id),
    });
    expect(saved).toMatchObject({ status: "DRAFT", durationMinutes: 20 });

    const lessons = await localDb.query.lessons.findMany();
    const text = lessons.find(
      (l: { lessonType: string }) => l.lessonType === "TEXT",
    );
    expect(text.content).toBe(ARTICLE);
  });

  it("explains a cut-off answer instead of saving half a course", async () => {
    const { generateCourseWithAI } =
      await import("@/services/lms/generate-course-with-ai");
    nextAnswer = { stop_reason: "max_tokens", input: OUTLINE };
    const before = (await localDb.query.courses.findMany()).length;

    await expect(
      generateCourseWithAI(admin, {
        topic: "Fixer ses prix",
        moduleCount: 1,
        contentType: "TEXT",
      }),
    ).rejects.toThrow("trop longue pour être générée d'un coup");
    expect((await localDb.query.courses.findMany()).length).toBe(before);
  });

  it("refuses an out-of-range module count before calling the API", async () => {
    const { generateCourseWithAI } =
      await import("@/services/lms/generate-course-with-ai");
    const calls = requests.length;
    await expect(
      generateCourseWithAI(admin, {
        topic: "Fixer ses prix",
        moduleCount: 50,
        contentType: "TEXT",
      }),
    ).rejects.toThrow("entre 1 et 10");
    expect(requests.length).toBe(calls);
  });
});
