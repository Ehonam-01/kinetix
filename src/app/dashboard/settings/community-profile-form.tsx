"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateCommunityProfileAction } from "./actions";

// goal/skills/directoryVisible used to be editable here too, for the
// general member directory (dashboard/community) — now hidden, only the
// mentor directory (dashboard/mentors) is public, and it only ever reads
// bio. Those three fields are passed through unchanged (the backend schema
// in schemas/community-profile.ts still requires them) rather than exposing
// inputs that would no longer have any visible effect.
export function CommunityProfileForm({
  bio,
  goal,
  skills,
  directoryVisible,
}: {
  bio: string;
  goal: string;
  skills: string[];
  directoryVisible: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [bioValue, setBioValue] = useState(bio);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateCommunityProfileAction({
        bio: bioValue,
        goal,
        skills,
        directoryVisible,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          value={bioValue}
          maxLength={280}
          rows={3}
          onChange={(e) => setBioValue(e.target.value)}
          placeholder="Quelques mots sur toi, ce que tu construis, ce que tu cherches..."
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px]"
        />
        <p className="text-muted-foreground text-xs">{bioValue.length}/280</p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && (
        <p className="text-sm text-green-600">Bio mise à jour.</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
