"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinAmbassadorProgramAction } from "./actions";

export function JoinAmbassadorForm({
  defaultSponsorUsername,
}: {
  defaultSponsorUsername?: string;
}) {
  const [sponsorUsername, setSponsorUsername] = useState(
    defaultSponsorUsername ?? "",
  );
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinAmbassadorProgramAction(sponsorUsername.trim());
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sponsor">Pseudo du parrain (optionnel)</Label>
        <Input
          id="sponsor"
          value={sponsorUsername}
          onChange={(e) => setSponsorUsername(e.target.value)}
          placeholder="Laissez vide si vous n'en avez pas"
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          J&apos;accepte les conditions du programme ambassadeur — gratuit,
          sans obligation d&apos;achat ni de recrutement.
        </span>
      </label>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending || !accepted} onClick={handleJoin}>
        {pending ? "Inscription..." : "Rejoindre le programme ambassadeur"}
      </Button>
    </div>
  );
}
