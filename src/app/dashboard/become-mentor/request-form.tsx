"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestMentorStatusAction } from "./actions";

export function RequestMentorForm({
  defaultCategory,
  defaultPitch,
}: {
  defaultCategory?: string;
  defaultPitch?: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(defaultCategory ?? "");
  const [pitch, setPitch] = useState(defaultPitch ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category.trim()) {
      setError("Indiquez un domaine.");
      return;
    }
    startTransition(async () => {
      const result = await requestMentorStatusAction({ category, pitch });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
      router.refresh();
    });
  }

  if (submitted) {
    return (
      <p className="text-sm text-green-600">
        Demande envoyée — un administrateur va l&apos;examiner.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mentor-category">Domaine</Label>
        <Input
          id="mentor-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          maxLength={60}
          placeholder="Ex : Marketing digital, Vente, Comptabilité..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mentor-pitch">
          Pourquoi accompagner d&apos;autres membres ? (facultatif)
        </Label>
        <textarea
          id="mentor-pitch"
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          maxLength={280}
          rows={4}
          placeholder="Votre expérience, ce que vous pouvez apporter..."
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px]"
        />
        <p className="text-muted-foreground text-xs">{pitch.length}/280</p>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Envoi..." : "Envoyer la demande"}
      </Button>
    </form>
  );
}
