"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveQuizAction } from "./actions";

type OptionDraft = { key: string; text: string; isCorrect: boolean };
type QuestionDraft = { key: string; question: string; options: OptionDraft[] };

function newOption(): OptionDraft {
  return { key: crypto.randomUUID(), text: "", isCorrect: false };
}
function newQuestion(): QuestionDraft {
  return {
    key: crypto.randomUUID(),
    question: "",
    options: [newOption(), newOption()],
  };
}

export function QuizEditor({
  courseId,
  lessonId,
  initialPassingScore,
  initialQuestions,
}: {
  courseId: string;
  lessonId: string;
  initialPassingScore: number;
  initialQuestions: {
    question: string;
    options: { text: string; isCorrect: boolean }[];
  }[];
}) {
  const [passingScore, setPassingScore] = useState(initialPassingScore);
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    initialQuestions.length > 0
      ? initialQuestions.map((q) => ({
          key: crypto.randomUUID(),
          question: q.question,
          options: q.options.map((o) => ({
            key: crypto.randomUUID(),
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        }))
      : [newQuestion()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const valid =
    questions.length > 0 &&
    questions.every(
      (q) =>
        q.question.trim() !== "" &&
        q.options.length >= 2 &&
        q.options.every((o) => o.text.trim() !== "") &&
        q.options.some((o) => o.isCorrect),
    );

  function updateQuestion(key: string, patch: Partial<QuestionDraft>) {
    setQuestions((qs) =>
      qs.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );
  }

  function updateOption(
    qKey: string,
    oKey: string,
    patch: Partial<OptionDraft>,
  ) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.key !== qKey
          ? q
          : {
              ...q,
              options: q.options.map((o) =>
                o.key === oKey ? { ...o, ...patch } : o,
              ),
            },
      ),
    );
  }

  function setCorrectOption(qKey: string, oKey: string) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.key !== qKey
          ? q
          : {
              ...q,
              options: q.options.map((o) => ({
                ...o,
                isCorrect: o.key === oKey,
              })),
            },
      ),
    );
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveQuizAction(courseId, lessonId, {
        passingScore,
        questions: questions.map((q) => ({
          question: q.question,
          options: q.options.map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        })),
      });
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="passing-score">Seuil de réussite (%)</Label>
        <Input
          id="passing-score"
          type="number"
          min={1}
          max={100}
          value={passingScore}
          onChange={(e) => setPassingScore(Number(e.target.value))}
          className="max-w-32"
        />
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={q.key} className="border-border rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`q-${q.key}`}>Question {qi + 1}</Label>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((qs) => qs.filter((x) => x.key !== q.key))
                  }
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Supprimer la question"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            <Input
              id={`q-${q.key}`}
              value={q.question}
              onChange={(e) =>
                updateQuestion(q.key, { question: e.target.value })
              }
              className="mt-2"
              placeholder="Énoncé de la question"
            />

            <div className="mt-3 space-y-2">
              {q.options.map((o) => (
                <div key={o.key} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.key}`}
                    checked={o.isCorrect}
                    onChange={() => setCorrectOption(q.key, o.key)}
                    title="Bonne réponse"
                    className="accent-primary"
                  />
                  <Input
                    value={o.text}
                    onChange={(e) =>
                      updateOption(q.key, o.key, { text: e.target.value })
                    }
                    placeholder="Texte de l'option"
                    className="flex-1"
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateQuestion(q.key, {
                          options: q.options.filter((x) => x.key !== o.key),
                        })
                      }
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Supprimer l'option"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateQuestion(q.key, {
                    options: [...q.options, newOption()],
                  })
                }
                className="text-primary flex items-center gap-1 text-xs font-medium"
              >
                <Plus className="size-3.5" />
                Ajouter une option
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
        className="text-primary flex items-center gap-1 text-sm font-medium"
      >
        <Plus className="size-4" />
        Ajouter une question
      </button>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-sm text-green-600">Quiz enregistré.</p>}
      <Button disabled={pending || !valid} onClick={handleSave}>
        {pending ? "Enregistrement..." : "Enregistrer le quiz"}
      </Button>
    </div>
  );
}
