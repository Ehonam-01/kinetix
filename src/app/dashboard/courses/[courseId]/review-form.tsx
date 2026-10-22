"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StarRatingInput } from "@/components/star-rating";
import { deleteCourseReviewAction, saveCourseReviewAction } from "./actions";

// The member's own review of the course: stars and an optional comment,
// editable and removable.
export function CourseReviewForm({
  courseId,
  existing,
}: {
  courseId: string;
  existing: { rating: number; comment: string | null } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [editing, setEditing] = useState(!existing);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    if (rating < 1) {
      setMessage({ ok: false, text: "Choisis une note de 1 à 5 étoiles." });
      return;
    }
    startTransition(async () => {
      const result = await saveCourseReviewAction(courseId, {
        rating,
        comment,
      });
      if (result.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({ ok: true, text: "Merci pour ton avis !" });
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteCourseReviewAction(courseId);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setRating(0);
      setComment("");
      setEditing(true);
      router.refresh();
    });
  }

  if (!editing && existing) {
    return (
      <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm">
        <p>
          {message?.ok
            ? message.text
            : "Tu as donné ton avis sur cette formation."}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Modifier mon avis
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={remove}>
            Supprimer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-brand-accent/30 bg-brand-accent/5 space-y-3 rounded-xl border p-4">
      <p className="text-sm font-medium">
        {existing ? "Modifier ton avis" : "Qu'as-tu pensé de cette formation ?"}
      </p>
      <StarRatingInput value={rating} onChange={setRating} />
      <textarea
        rows={3}
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Ce qui t'a aidé, ce qui pourrait être amélioré… (facultatif)"
        aria-label="Ton commentaire"
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 bg-background w-full rounded-lg border px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-3 md:text-sm"
      />
      {message && (
        <p
          className={
            message.ok ? "text-sm text-green-600" : "text-destructive text-sm"
          }
        >
          {message.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Envoi…" : "Publier mon avis"}
        </Button>
        {existing && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}
