"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestTrainerStatusAction } from "./actions";

const TEXTAREA_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-3 md:text-sm";

export function TrainerRequestForm({
  defaults,
}: {
  defaults?: {
    domain: string;
    courseTitle: string;
    courseOutline: string;
    experience: string;
    sampleUrl: string;
  };
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(defaults?.domain ?? "");
  const [courseTitle, setCourseTitle] = useState(defaults?.courseTitle ?? "");
  const [courseOutline, setCourseOutline] = useState(
    defaults?.courseOutline ?? "",
  );
  const [experience, setExperience] = useState(defaults?.experience ?? "");
  const [sampleUrl, setSampleUrl] = useState(defaults?.sampleUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestTrainerStatusAction({
        domain,
        courseTitle,
        courseOutline,
        experience,
        sampleUrl,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="trainer-domain">Ton domaine</Label>
          <Input
            id="trainer-domain"
            value={domain}
            maxLength={60}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Marketing digital"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trainer-title">Titre de la formation proposée</Label>
          <Input
            id="trainer-title"
            value={courseTitle}
            maxLength={120}
            onChange={(e) => setCourseTitle(e.target.value)}
            placeholder="Vendre sur WhatsApp Business"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="trainer-outline">Ce que la formation apprendra</Label>
        <textarea
          id="trainer-outline"
          rows={5}
          maxLength={2000}
          value={courseOutline}
          onChange={(e) => setCourseOutline(e.target.value)}
          placeholder="Les grandes parties de la formation, ce que l'apprenant saura faire à la fin…"
          className={TEXTAREA_CLASS}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="trainer-experience">Ton expérience</Label>
        <textarea
          id="trainer-experience"
          rows={4}
          maxLength={1500}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          placeholder="Ton parcours, tes réalisations, si tu as déjà formé ou accompagné des personnes…"
          className={TEXTAREA_CLASS}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="trainer-sample">
          Lien vers ton travail{" "}
          <span className="text-muted-foreground font-normal">
            (facultatif)
          </span>
        </Label>
        <Input
          id="trainer-sample"
          type="url"
          value={sampleUrl}
          maxLength={300}
          onChange={(e) => setSampleUrl(e.target.value)}
          placeholder="https://… (portfolio, LinkedIn, vidéo d'exemple)"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        <Send className="size-4" />
        {pending ? "Envoi…" : "Envoyer ma candidature"}
      </Button>
    </form>
  );
}
