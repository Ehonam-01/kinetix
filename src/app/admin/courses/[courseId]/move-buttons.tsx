"use client";

import { useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveCourseItemAction } from "./actions";

// Up/down arrows to reorder a module within its course, or a lesson within
// its module.
export function MoveButtons({
  courseId,
  kind,
  id,
  isFirst,
  isLast,
}: {
  courseId: string;
  kind: "module" | "lesson";
  id: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const label = kind === "module" ? "le module" : "la leçon";

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveCourseItemAction(courseId, kind, id, direction);
      if (result.error) alert(result.error);
    });
  }

  return (
    <div className="flex items-center">
      <Button
        size="icon-xs"
        variant="ghost"
        disabled={pending || isFirst}
        onClick={() => move("up")}
        aria-label={`Monter ${label}`}
        title={`Monter ${label}`}
      >
        <ChevronUp />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        disabled={pending || isLast}
        onClick={() => move("down")}
        aria-label={`Descendre ${label}`}
        title={`Descendre ${label}`}
      >
        <ChevronDown />
      </Button>
    </div>
  );
}
