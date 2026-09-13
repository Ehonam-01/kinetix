"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateCourseAction } from "./actions";

const CONTENT_TYPES = ["MIXED", "TEXT", "VIDEO"] as const;
const CONTENT_TYPE_LABEL: Record<(typeof CONTENT_TYPES)[number], string> = {
  MIXED: "Mixte (l'IA choisit selon le sujet)",
  TEXT: "Texte + quiz uniquement",
  VIDEO: "Vidéo uniquement (à uploader ensuite)",
};

export function GenerateCourseForm() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [moduleCount, setModuleCount] = useState("4");
  const [contentType, setContentType] =
    useState<(typeof CONTENT_TYPES)[number]>("MIXED");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = topic.trim() !== "" && Number(moduleCount) >= 1;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await generateCourseAction({
        topic,
        moduleCount: Number(moduleCount),
        contentType,
        level: level || undefined,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="topic">Sujet du cours</Label>
        <Input
          id="topic"
          placeholder="Ex. Marketing digital pour entrepreneurs"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="level">Niveau (optionnel)</Label>
          <Input
            id="level"
            placeholder="Débutant, intermédiaire..."
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="module-count">Nombre de modules</Label>
          <Input
            id="module-count"
            type="number"
            min={1}
            max={10}
            value={moduleCount}
            onChange={(e) => setModuleCount(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-type">Type de contenu</Label>
        <select
          id="content-type"
          value={contentType}
          onChange={(e) =>
            setContentType(e.target.value as (typeof CONTENT_TYPES)[number])
          }
          className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <p className="text-muted-foreground text-xs">
        Le cours est créé en brouillon — relis et complète (vidéos, ajustements)
        avant de le publier.
      </p>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button disabled={pending || !canSubmit} onClick={handleSubmit}>
        <Sparkles className="size-4" />
        {pending ? "Génération en cours..." : "Générer le cours"}
      </Button>
    </div>
  );
}
