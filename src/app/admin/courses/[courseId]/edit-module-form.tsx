"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateModuleAction } from "./actions";

export function EditModuleForm({
  courseId,
  moduleId,
  currentTitle,
  currentIsActive,
}: {
  courseId: string;
  moduleId: string;
  currentTitle: string;
  currentIsActive: boolean;
}) {
  const [title, setTitle] = useState(currentTitle);
  const [isActive, setIsActive] = useState(currentIsActive);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = title !== currentTitle || isActive !== currentIsActive;

  return (
    <div className="flex items-center gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-7 max-w-56 text-sm"
      />
      <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Actif
      </label>
      {dirty && (
        <Button
          size="xs"
          variant="outline"
          disabled={pending || title.trim() === ""}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await updateModuleAction(courseId, moduleId, {
                title,
                isActive,
              });
              if (result.error) setError(result.error);
            })
          }
        >
          {pending ? "..." : "Enregistrer"}
        </Button>
      )}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
