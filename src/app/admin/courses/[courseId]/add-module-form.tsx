"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModuleAction } from "./actions";

export function AddModuleForm({ courseId }: { courseId: string }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Titre du nouveau module"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-xs"
        />
        <Button
          size="sm"
          disabled={pending || title.trim() === ""}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await createModuleAction(courseId, title);
              if (result.error) {
                setError(result.error);
                return;
              }
              setTitle("");
            })
          }
        >
          {pending ? "..." : "Ajouter un module"}
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
