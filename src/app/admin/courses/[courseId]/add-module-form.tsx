"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModuleAction } from "./actions";

export function AddModuleForm({ courseId }: { courseId: string }) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  return (
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
            await createModuleAction(courseId, title);
            setTitle("");
          })
        }
      >
        {pending ? "..." : "Ajouter un module"}
      </Button>
    </div>
  );
}
