"use client";

import { useState, useTransition, type FormEvent } from "react";
import { GOAL_OPTIONS } from "@/config/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCommunityProfileAction } from "./actions";

function parseSkills(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

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
  const [values, setValues] = useState({
    bio,
    goal,
    skillsInput: skills.join(", "),
    directoryVisible,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateCommunityProfileAction({
        bio: values.bio,
        goal: values.goal,
        skills: parseSkills(values.skillsInput),
        directoryVisible: values.directoryVisible,
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
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={values.directoryVisible}
          onChange={(e) =>
            setValues((v) => ({ ...v, directoryVisible: e.target.checked }))
          }
        />
        <span>
          Afficher mon profil dans l&apos;annuaire des membres
          <span className="text-muted-foreground block text-xs">
            Décoché, ton nom et tes informations n&apos;apparaissent plus
            dans la liste des autres membres.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="goal">Ton objectif</Label>
        <select
          id="goal"
          value={values.goal}
          onChange={(e) => setValues((v) => ({ ...v, goal: e.target.value }))}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px]"
        >
          <option value="">Non renseigné</option>
          {GOAL_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          value={values.bio}
          maxLength={280}
          rows={3}
          onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))}
          placeholder="Quelques mots sur toi, ce que tu construis, ce que tu cherches..."
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px]"
        />
        <p className="text-muted-foreground text-xs">{values.bio.length}/280</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skills">Compétences (séparées par des virgules)</Label>
        <Input
          id="skills"
          value={values.skillsInput}
          onChange={(e) =>
            setValues((v) => ({ ...v, skillsInput: e.target.value }))
          }
          placeholder="Marketing digital, Design, Excel..."
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && (
        <p className="text-sm text-green-600">
          Profil communautaire mis à jour.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
