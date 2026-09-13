"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCourseThumbnailAction } from "./thumbnail-actions";

export function EditThumbnailForm({
  courseId,
  currentThumbnailUrl,
}: {
  courseId: string;
  currentThumbnailUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(currentThumbnailUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadCourseThumbnailAction(courseId, file);
      if (result.error || !result.thumbnailUrl) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      setThumbnailUrl(result.thumbnailUrl);
    });
  }

  return (
    <div className="space-y-3">
      <div className="border-border bg-muted relative aspect-video w-full max-w-64 overflow-hidden rounded-xl border">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
          <img src={thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1 text-xs">
            <ImageIcon className="size-6" />
            Aucune miniature
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending
          ? "Envoi..."
          : thumbnailUrl
            ? "Changer la miniature"
            : "Ajouter une miniature"}
      </Button>
    </div>
  );
}
