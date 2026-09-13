"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitQuizAttemptAction } from "./actions";

type QuizQuestionView = {
  id: string;
  question: string;
  options: { id: string; text: string }[];
};

type QuizResult = {
  score: number;
  passed: boolean;
  passingScore: number;
  results: { questionId: string; correct: boolean; correctOptionId: string }[];
};

export function QuizForm({
  courseId,
  lessonId,
  questions,
}: {
  courseId: string;
  lessonId: string;
  questions: QuizQuestionView[];
}) {
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = questions.every((q) => answers[q.id]);
  const resultByQuestion = new Map(
    result?.results.map((r) => [r.questionId, r]) ?? [],
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await submitQuizAttemptAction(courseId, lessonId, answers);
        setResult(res);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue.",
        );
      }
    });
  }

  function handleRetry() {
    setResult(null);
    setAnswers({});
  }

  if (result?.passed) {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border p-8 text-center">
        <CheckCircle2 className="size-8 text-emerald-500" />
        <p className="font-medium">
          Quiz réussi — {result.score}% (seuil : {result.passingScore}%)
        </p>
        <p className="text-muted-foreground text-sm">
          Cette leçon est marquée comme terminée.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {result && !result.passed && (
        <div className="border-destructive/30 bg-destructive/5 rounded-2xl border p-4">
          <p className="text-destructive flex items-center gap-2 text-sm font-medium">
            <XCircle className="size-4 shrink-0" />
            Score : {result.score}% — il faut au moins {result.passingScore}%
            pour valider cette leçon.
          </p>
        </div>
      )}

      {questions.map((q, qi) => {
        const questionResult = resultByQuestion.get(q.id);
        return (
          <fieldset
            key={q.id}
            className="border-border bg-card rounded-2xl border p-5"
          >
            <legend className="px-1 text-sm font-medium">
              {qi + 1}. {q.question}
            </legend>
            <div className="mt-3 space-y-2">
              {q.options.map((option) => {
                const selected = answers[q.id] === option.id;
                const showFeedback = !!questionResult;
                const isCorrectOption =
                  questionResult?.correctOptionId === option.id;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                      showFeedback &&
                        isCorrectOption &&
                        "border-emerald-500 bg-emerald-500/10",
                      showFeedback &&
                        selected &&
                        !isCorrectOption &&
                        "border-destructive bg-destructive/10",
                    )}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={option.id}
                      checked={selected}
                      disabled={!!result}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [q.id]: option.id }))
                      }
                      className="accent-primary"
                    />
                    {option.text}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {error && <p className="text-destructive text-sm">{error}</p>}

      {result && !result.passed ? (
        <Button onClick={handleRetry}>Réessayer</Button>
      ) : (
        <Button disabled={!allAnswered || pending} onClick={handleSubmit}>
          {pending ? "Envoi..." : "Valider le quiz"}
        </Button>
      )}
    </div>
  );
}
