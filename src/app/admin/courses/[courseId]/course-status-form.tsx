"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateCourseStatusAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
};

export function CourseStatusForm({
  courseId,
  status,
}: {
  courseId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  function setStatus(next: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    startTransition(() => updateCourseStatusAction(courseId, next));
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-medium",
          status === "PUBLISHED" && "bg-green-600/10 text-green-600",
          status === "DRAFT" && "bg-muted text-muted-foreground",
          status === "ARCHIVED" && "bg-destructive/10 text-destructive",
        )}
      >
        {STATUS_LABEL[status] ?? status}
      </span>
      {status !== "PUBLISHED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setStatus("PUBLISHED")}
        >
          Publier
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setStatus("DRAFT")}
        >
          Repasser en brouillon
        </Button>
      )}
    </div>
  );
}
