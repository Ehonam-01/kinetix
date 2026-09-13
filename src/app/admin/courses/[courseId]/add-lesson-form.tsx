"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLessonAction } from "./actions";

const PROVIDERS = ["YOUTUBE", "VIMEO", "OTHER"] as const;
const LESSON_TYPES = ["VIDEO", "TEXT"] as const;
const LESSON_TYPE_LABEL: Record<(typeof LESSON_TYPES)[number], string> = {
  VIDEO: "Vidéo",
  TEXT: "Texte",
};

export function AddLessonForm({
  courseId,
  moduleId,
}: {
  courseId: string;
  moduleId: string;
}) {
  const [title, setTitle] = useState("");
  const [lessonType, setLessonType] =
    useState<(typeof LESSON_TYPES)[number]>("VIDEO");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoProvider, setVideoProvider] =
    useState<(typeof PROVIDERS)[number]>("YOUTUBE");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  const canSubmit =
    title.trim() !== "" && (lessonType === "TEXT" || videoUrl.trim() !== "");

  return (
    <div className="mt-2 space-y-2 border-t pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Titre de la leçon"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-48"
        />
        <select
          value={lessonType}
          onChange={(e) =>
            setLessonType(e.target.value as (typeof LESSON_TYPES)[number])
          }
          className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
        >
          {LESSON_TYPES.map((t) => (
            <option key={t} value={t}>
              {LESSON_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        {lessonType === "VIDEO" ? (
          <>
            <select
              value={videoProvider}
              onChange={(e) =>
                setVideoProvider(e.target.value as (typeof PROVIDERS)[number])
              }
              className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Input
              placeholder="URL de la vidéo"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="max-w-64"
            />
          </>
        ) : (
          <Input
            placeholder="Contenu de l'article (optionnel pour l'instant)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="max-w-64"
          />
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !canSubmit}
          onClick={() =>
            startTransition(async () => {
              await createLessonAction(courseId, {
                moduleId,
                title,
                lessonType,
                videoProvider:
                  lessonType === "VIDEO" ? videoProvider : undefined,
                videoUrl: lessonType === "VIDEO" ? videoUrl : undefined,
                content: lessonType === "TEXT" ? content : undefined,
              });
              setTitle("");
              setVideoUrl("");
              setContent("");
            })
          }
        >
          {pending ? "..." : "Ajouter une leçon"}
        </Button>
      </div>
      {lessonType === "TEXT" && (
        <p className="text-muted-foreground text-xs">
          Le contenu complet et le quiz se modifient ensuite depuis la page de
          la leçon.
        </p>
      )}
    </div>
  );
}
