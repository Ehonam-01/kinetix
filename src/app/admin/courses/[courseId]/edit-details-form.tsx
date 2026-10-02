"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCourseDetailsAction } from "./actions";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

export function EditDetailsForm({
  courseId,
  currentTitle,
  currentDescription,
}: {
  courseId: string;
  currentTitle: string;
  currentDescription: string | null;
}) {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const unchanged =
    title.trim() === currentTitle &&
    (description.trim() || null) === (currentDescription ?? null);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCourseDetailsAction(courseId, {
        title,
        description: description.trim() || null,
      });
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="course-title">Titre</Label>
        <Input
          id="course-title"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="course-description">Description</Label>
        <textarea
          id="course-description"
          value={description}
          maxLength={DESCRIPTION_MAX}
          rows={7}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-3"
        />
        <p className="text-muted-foreground text-right text-xs">
          {description.length} / {DESCRIPTION_MAX}
        </p>
      </div>
      <p className="text-muted-foreground text-xs">
        L&apos;adresse publique du cours ne change pas quand vous le renommez :
        les liens déjà partagés continuent de fonctionner.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && (
        <p className="text-sm text-emerald-600">Modifications enregistrées.</p>
      )}
      <Button
        size="sm"
        disabled={pending || unchanged || title.trim() === ""}
        onClick={handleSave}
      >
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  );
}
