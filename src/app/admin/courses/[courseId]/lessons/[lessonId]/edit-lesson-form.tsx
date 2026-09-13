"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLessonAction } from "./actions";

const PROVIDERS = ["YOUTUBE", "VIMEO", "OTHER"] as const;
const LESSON_TYPES = ["VIDEO", "TEXT"] as const;
const LESSON_TYPE_LABEL: Record<(typeof LESSON_TYPES)[number], string> = {
  VIDEO: "Vidéo",
  TEXT: "Texte",
};

export function EditLessonForm({
  courseId,
  lessonId,
  initial,
}: {
  courseId: string;
  lessonId: string;
  initial: {
    title: string;
    description: string;
    lessonType: (typeof LESSON_TYPES)[number];
    videoProvider: (typeof PROVIDERS)[number];
    videoUrl: string;
    content: string;
    isActive: boolean;
  };
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [lessonType, setLessonType] = useState(initial.lessonType);
  const [videoProvider, setVideoProvider] = useState(initial.videoProvider);
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [content, setContent] = useState(initial.content);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const canSubmit =
    title.trim() !== "" && (lessonType === "TEXT" || videoUrl.trim() !== "");

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateLessonAction(courseId, lessonId, {
        title,
        description: description || undefined,
        lessonType,
        videoProvider: lessonType === "VIDEO" ? videoProvider : undefined,
        videoUrl: lessonType === "VIDEO" ? videoUrl : undefined,
        content: lessonType === "TEXT" ? content : undefined,
        isActive,
      });
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lesson-title">Titre</Label>
        <Input
          id="lesson-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lesson-description">Description</Label>
        <Input
          id="lesson-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lesson-type">Type</Label>
        <select
          id="lesson-type"
          value={lessonType}
          onChange={(e) =>
            setLessonType(e.target.value as (typeof LESSON_TYPES)[number])
          }
          className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
        >
          {LESSON_TYPES.map((t) => (
            <option key={t} value={t}>
              {LESSON_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {lessonType === "VIDEO" ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lesson-provider">Fournisseur</Label>
            <select
              id="lesson-provider"
              value={videoProvider}
              onChange={(e) =>
                setVideoProvider(e.target.value as (typeof PROVIDERS)[number])
              }
              className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson-video-url">URL de la vidéo</Label>
            <Input
              id="lesson-video-url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="lesson-content">Contenu de l&apos;article</Label>
          <textarea
            id="lesson-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="border-input w-full rounded-lg border bg-transparent p-2.5 text-sm"
          />
        </div>
      )}

      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Leçon active (visible des apprenants)
      </label>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-sm text-green-600">Leçon enregistrée.</p>}
      <Button disabled={pending || !canSubmit} onClick={handleSave}>
        {pending ? "Enregistrement..." : "Enregistrer la leçon"}
      </Button>
    </div>
  );
}
