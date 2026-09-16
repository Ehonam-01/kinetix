"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCourseAction } from "./actions";

export function NewCourseForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Titre</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <Button
        disabled={pending || title.trim() === ""}
        onClick={() =>
          startTransition(() =>
            createCourseAction({
              title,
              description: description || undefined,
            }),
          )
        }
      >
        {pending ? "Création..." : "Créer le cours"}
      </Button>
    </div>
  );
}
