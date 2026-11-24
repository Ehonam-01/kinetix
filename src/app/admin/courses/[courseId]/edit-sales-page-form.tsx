"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SALES_PAGE_LIMITS,
  splitLines,
  type CourseSalesPage,
} from "@/lib/course-sales-page";
import { updateCourseSalesPageAction } from "./actions";

const TEXTAREA =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3";

export function EditSalesPageForm({
  courseId,
  current,
}: {
  courseId: string;
  current: CourseSalesPage;
}) {
  const [videoUrl, setVideoUrl] = useState(current.previewVideoUrl ?? "");
  const [outcomes, setOutcomes] = useState(current.learningOutcomes.join("\n"));
  const [audience, setAudience] = useState(current.targetAudience.join("\n"));
  const [faq, setFaq] = useState(current.faq);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function setFaqItem(
    index: number,
    key: "question" | "answer",
    value: string,
  ) {
    setFaq((items) =>
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCourseSalesPageAction(courseId, {
        previewVideoUrl: videoUrl.trim() || null,
        learningOutcomes: splitLines(outcomes),
        targetAudience: splitLines(audience),
        faq,
      });
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="preview-video">
          Vidéo d&apos;aperçu (lien YouTube)
        </Label>
        <Input
          id="preview-video"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://youtu.be/..."
        />
        <p className="text-muted-foreground text-xs">
          La miniature s&apos;affiche avec un bouton lecture ; la vidéo démarre
          au clic, sans les bandeaux YouTube. Une vidéo non répertoriée
          convient.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="learning-outcomes">
          Ce que tu vas apprendre (une ligne par point,{" "}
          {SALES_PAGE_LIMITS.outcomes} au plus)
        </Label>
        <textarea
          id="learning-outcomes"
          rows={5}
          value={outcomes}
          onChange={(e) => setOutcomes(e.target.value)}
          placeholder={
            "Écrire un prompt qui donne une vidéo réaliste\nCréer une publicité pour ton produit"
          }
          className={TEXTAREA}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="target-audience">
          Pour qui ? (une ligne par profil, {SALES_PAGE_LIMITS.audience} au
          plus)
        </Label>
        <textarea
          id="target-audience"
          rows={3}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder={
            "Les créateurs de contenu qui veulent publier plus vite\nLes commerçants qui veulent des publicités sans tournage"
          }
          className={TEXTAREA}
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          Questions fréquentes ({SALES_PAGE_LIMITS.faq} au plus)
        </p>
        {faq.map((item, index) => (
          <div key={index} className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Question ${index + 1}`}
                value={item.question}
                onChange={(e) => setFaqItem(index, "question", e.target.value)}
                placeholder="Question"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Retirer la question ${index + 1}`}
                onClick={() =>
                  setFaq((items) => items.filter((_, i) => i !== index))
                }
              >
                <Trash2 />
              </Button>
            </div>
            <textarea
              aria-label={`Réponse ${index + 1}`}
              rows={2}
              value={item.answer}
              onChange={(e) => setFaqItem(index, "answer", e.target.value)}
              placeholder="Réponse"
              className={TEXTAREA}
            />
          </div>
        ))}
        {faq.length < SALES_PAGE_LIMITS.faq && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              setFaq((items) => [...items, { question: "", answer: "" }])
            }
          >
            <Plus />
            Ajouter une question
          </Button>
        )}
        <p className="text-muted-foreground text-xs">
          L&apos;accès à vie, le paiement Mobile Money et la politique de
          remboursement sont déjà rappelés sur la page : inutile de les répéter
          ici.
        </p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-sm text-green-600">Enregistré.</p>}
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={handleSave}
      >
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  );
}
