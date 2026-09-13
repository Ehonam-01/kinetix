"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markLessonCompleteAction } from "./actions";

export function MarkCompleteButton({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(() => markLessonCompleteAction(courseId, lessonId))
      }
    >
      {pending ? "..." : "Marquer comme terminée"}
    </Button>
  );
}
