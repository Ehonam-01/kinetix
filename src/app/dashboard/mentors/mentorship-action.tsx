"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StarRatingInput } from "@/components/star-rating";
import { requestMentorshipAction, submitMentorReviewAction } from "./actions";

type Mentorship = { id: string; status: "REQUESTED" | "ACCEPTED" | "DECLINED" };
type ExistingReview = { rating: number; comment: string | null };

export function MentorshipAction({
  mentorUserId,
  mentorship,
  existingReview,
}: {
  mentorUserId: string;
  mentorship: Mentorship | null;
  existingReview: ExistingReview | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestMentorshipAction(mentorUserId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (!mentorship || mentorship.status === "DECLINED") {
    return (
      <div className="space-y-1">
        {mentorship?.status === "DECLINED" && (
          <p className="text-muted-foreground text-xs">
            Votre précédente demande a été refusée.
          </p>
        )}
        <Button size="sm" variant="outline" disabled={pending} onClick={handleRequest}>
          {mentorship ? "Redemander un accompagnement" : "Demander un accompagnement"}
        </Button>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    );
  }

  if (mentorship.status === "REQUESTED") {
    return (
      <p className="text-muted-foreground text-xs">
        Demande d&apos;accompagnement envoyée — en attente de réponse.
      </p>
    );
  }

  return (
    <ReviewForm mentorshipId={mentorship.id} existingReview={existingReview} />
  );
}

function ReviewForm({
  mentorshipId,
  existingReview,
}: {
  mentorshipId: string;
  existingReview: ExistingReview | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    if (rating < 1) {
      setError("Choisissez une note.");
      return;
    }
    startTransition(async () => {
      const result = await submitMentorReviewAction({ mentorshipId, rating, comment });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <p className="text-xs font-medium">
        {existingReview ? "Modifier votre avis" : "Laisser un avis"}
      </p>
      <StarRatingInput value={rating} onChange={setRating} />
      <textarea
        value={comment ?? ""}
        onChange={(e) => setComment(e.target.value)}
        maxLength={280}
        rows={2}
        placeholder="Votre expérience avec ce mentor (facultatif)"
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2 py-1.5 text-xs shadow-xs focus-visible:ring-[3px]"
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
      {saved && !pending && (
        <p className="text-xs text-green-600">Avis enregistré.</p>
      )}
      <Button size="sm" disabled={pending} onClick={handleSubmit}>
        {pending ? "Envoi..." : existingReview ? "Mettre à jour" : "Envoyer l'avis"}
      </Button>
    </div>
  );
}
