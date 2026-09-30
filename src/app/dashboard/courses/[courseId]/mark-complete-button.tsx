"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markLessonCompleteAction } from "./actions";

// Marks the lesson done, then moves straight on to nextHref (the next
// lesson, or the course page once the last one is done).
export function MarkCompleteButton({
  courseId,
  lessonId,
  nextHref,
  label = "Marquer comme terminée",
}: {
  courseId: string;
  lessonId: string;
  nextHref?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markLessonCompleteAction(courseId, lessonId);
          if (nextHref) router.push(nextHref);
        })
      }
    >
      <CheckCircle2 className="size-4" />
      {pending ? "Enregistrement..." : label}
    </Button>
  );
}
