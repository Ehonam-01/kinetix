"use client";

import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DRIVE_SHARING_HINT,
  VIDEO_PROVIDER_LABEL,
} from "@/lib/lesson-media-labels";
import { Input } from "@/components/ui/input";
import { createLessonAction } from "./actions";

const PROVIDERS = ["YOUTUBE", "VIMEO", "OTHER"] as const;
const LESSON_TYPES = ["VIDEO", "TEXT"] as const;
const LESSON_TYPE_LABEL: Record<(typeof LESSON_TYPES)[number], string> = {
  VIDEO: "Vidéo ou Google Drive",
  TEXT: "Texte",
};

const SELECT_CLASS =
  "border-input h-8 w-full rounded-lg border bg-transparent px-2 text-sm";

// One field per row, so it fits however narrow the module card is (a
// single wrapping row used to squeeze the link field down to nothing,
// leaving the button greyed out with no visible reason).
export function AddLessonForm({
  courseId,
  moduleId,
}: {
  courseId: string;
  moduleId: string;
}) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [lessonType, setLessonType] =
    useState<(typeof LESSON_TYPES)[number]>("VIDEO");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoProvider, setVideoProvider] =
    useState<(typeof PROVIDERS)[number]>("YOUTUBE");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = title.trim() !== "";

  function handleAdd() {
    startTransition(async () => {
      setError(null);
      setAdded(null);
      const result = await createLessonAction(courseId, {
        moduleId,
        title,
        lessonType,
        videoProvider: lessonType === "VIDEO" ? videoProvider : undefined,
        videoUrl: lessonType === "VIDEO" ? videoUrl : undefined,
        content: lessonType === "TEXT" ? content : undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setAdded(title.trim());
      setTitle("");
      setVideoUrl("");
      setContent("");
    });
  }

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <p className="text-sm font-medium">Ajouter une leçon</p>

      <div className="space-y-1">
        <label
          htmlFor={`${id}-title`}
          className="text-muted-foreground text-xs"
        >
          Titre
        </label>
        <Input
          id={`${id}-title`}
          placeholder="Ex. Séance 1 — Les bases du montage"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor={`${id}-type`}
            className="text-muted-foreground text-xs"
          >
            Type
          </label>
          <select
            id={`${id}-type`}
            value={lessonType}
            onChange={(e) =>
              setLessonType(e.target.value as (typeof LESSON_TYPES)[number])
            }
            className={SELECT_CLASS}
          >
            {LESSON_TYPES.map((t) => (
              <option key={t} value={t}>
                {LESSON_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {lessonType === "VIDEO" && (
          <div className="space-y-1">
            <label
              htmlFor={`${id}-provider`}
              className="text-muted-foreground text-xs"
            >
              Source
            </label>
            <select
              id={`${id}-provider`}
              value={videoProvider}
              onChange={(e) =>
                setVideoProvider(e.target.value as (typeof PROVIDERS)[number])
              }
              className={SELECT_CLASS}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {VIDEO_PROVIDER_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {lessonType === "VIDEO" ? (
        <div className="space-y-1">
          <label
            htmlFor={`${id}-url`}
            className="text-muted-foreground text-xs"
          >
            {videoProvider === "OTHER"
              ? "Lien Google Drive"
              : "Lien de la vidéo"}{" "}
            <span className="opacity-70">
              (facultatif, à ajouter plus tard)
            </span>
          </label>
          <Input
            id={`${id}-url`}
            placeholder={
              videoProvider === "OTHER"
                ? "https://drive.google.com/…"
                : "https://www.youtube.com/watch?v=…"
            }
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          {videoProvider === "OTHER" && (
            <p className="text-muted-foreground text-xs">
              {DRIVE_SHARING_HINT}
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Le contenu de l&apos;article et le quiz se rédigent ensuite depuis la
          page de la leçon.
        </p>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
      {added && (
        <p className="text-sm text-emerald-600">Leçon « {added} » ajoutée.</p>
      )}
      <Button
        size="sm"
        disabled={pending || !canSubmit}
        onClick={handleAdd}
        title={canSubmit ? undefined : "Donnez d'abord un titre à la leçon"}
      >
        <Plus className="size-4" />
        {pending ? "Ajout..." : "Ajouter la leçon"}
      </Button>
    </div>
  );
}
