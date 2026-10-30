"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCourseItemAction } from "./actions";

// Deletes a module or a lesson for good, after a confirmation that says what
// goes with it and how to hide it instead.
export function DeleteItemButton({
  courseId,
  kind,
  id,
  title,
  lessonCount = 0,
}: {
  courseId: string;
  kind: "module" | "lesson";
  id: string;
  title: string;
  lessonCount?: number;
}) {
  const [pending, startTransition] = useTransition();
  const label = kind === "module" ? "le module" : "la leçon";

  function handleClick() {
    const consequence =
      kind === "module"
        ? `Ses ${lessonCount} leçon(s) seront supprimées, avec leurs quiz, leurs discussions et la progression des membres.`
        : "Son quiz, ses discussions et la progression des membres seront supprimés.";
    const hide =
      kind === "module"
        ? "Pour le cacher sans rien perdre, décochez plutôt « Actif »."
        : "Pour la cacher sans rien perdre, décochez plutôt « Leçon active » dans Modifier.";
    const confirmed = window.confirm(
      `Supprimer définitivement ${label} « ${title} » ?\n\n${consequence} Cette action est irréversible.\n\n${hide}`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteCourseItemAction(courseId, kind, id);
      if (result.error) alert(result.error);
    });
  }

  return (
    <Button
      size="icon-xs"
      variant="ghost"
      disabled={pending}
      onClick={handleClick}
      aria-label={`Supprimer ${label}`}
      title={`Supprimer ${label}`}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 />
    </Button>
  );
}
