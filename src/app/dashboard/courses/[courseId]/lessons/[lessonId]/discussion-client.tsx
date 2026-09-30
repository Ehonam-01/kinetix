"use client";

import { useState, useTransition } from "react";
import { Flag, MessageSquareReply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteLessonPostAction,
  postLessonAnswerAction,
  postLessonQuestionAction,
  reportLessonPostAction,
} from "./actions";

const MAX = 2000;

function PostTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
        rows={rows}
        placeholder={placeholder}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-xl border bg-transparent p-3 text-sm outline-none focus-visible:ring-3"
      />
      <p className="text-muted-foreground text-right text-xs">
        {value.length} / {MAX}
      </p>
    </div>
  );
}

export function AskQuestionForm({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <label htmlFor="new-question" className="sr-only">
        Votre question
      </label>
      <PostTextarea
        id="new-question"
        value={body}
        onChange={setBody}
        placeholder="Une question sur cette leçon ? Posez-la ici."
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button
        size="sm"
        disabled={pending || body.trim().length < 3}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await postLessonQuestionAction(
              courseId,
              lessonId,
              body,
            );
            if (result.error) setError(result.error);
            else setBody("");
          })
        }
      >
        {pending ? "Publication..." : "Publier la question"}
      </Button>
    </div>
  );
}

export function AnswerForm({
  courseId,
  lessonId,
  questionId,
}: {
  courseId: string;
  lessonId: string;
  questionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        <MessageSquareReply className="size-4" />
        Répondre
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`answer-${questionId}`} className="sr-only">
        Votre réponse
      </label>
      <PostTextarea
        id={`answer-${questionId}`}
        value={body}
        onChange={setBody}
        placeholder="Votre réponse…"
        rows={2}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || body.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await postLessonAnswerAction(
                courseId,
                lessonId,
                questionId,
                body,
              );
              if (result.error) setError(result.error);
              else {
                setBody("");
                setOpen(false);
              }
            })
          }
        >
          {pending ? "Envoi..." : "Envoyer"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}

// Delete (own post) or report (someone else's), each confirmed inline.
export function PostMenu({
  courseId,
  lessonId,
  postId,
  isMine,
  reportedByMe,
}: {
  courseId: string;
  lessonId: string;
  postId: string;
  isMine: boolean;
  reportedByMe: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (message) {
    return <span className="text-muted-foreground text-xs">{message}</span>;
  }
  if (!isMine && reportedByMe) {
    return <span className="text-muted-foreground text-xs">Signalé</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        {isMine ? (
          <>
            <Trash2 className="size-3.5" /> Supprimer
          </>
        ) : (
          <>
            <Flag className="size-3.5" /> Signaler
          </>
        )}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      {!isMine && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 200))}
          placeholder="Motif (facultatif)"
          aria-label="Motif du signalement"
          className="border-input h-7 w-40 rounded-lg border bg-transparent px-2"
        />
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = isMine
              ? await deleteLessonPostAction(courseId, lessonId, postId)
              : await reportLessonPostAction(
                  courseId,
                  lessonId,
                  postId,
                  reason,
                );
            setMessage(
              result.error ??
                (isMine ? "Supprimé." : "Merci, message signalé."),
            );
          })
        }
        className="text-destructive font-medium"
      >
        {isMine ? "Confirmer la suppression" : "Signaler"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="text-muted-foreground"
      >
        Annuler
      </button>
    </span>
  );
}
