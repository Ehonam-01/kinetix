"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertRewardAction, uploadRewardImageAction } from "./actions";

export function RewardEditor({
  levelCode,
  reward,
}: {
  levelCode: number;
  reward: {
    id: string;
    name: string;
    description: string | null;
    value: number;
    imageUrl: string | null;
  } | null;
}) {
  const [rewardId, setRewardId] = useState(reward?.id ?? null);
  const [name, setName] = useState(reward?.name ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [value, setValue] = useState(reward?.value?.toString() ?? "");
  const [imageUrl, setImageUrl] = useState(reward?.imageUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await upsertRewardAction({
        levelCode,
        name,
        description: description || undefined,
        value: Math.round(Number(value)),
      });
      if (result.error || !result.reward) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      setRewardId(result.reward.id);
      setSuccess(true);
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !rewardId) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadRewardImageAction(rewardId, file);
      if (result.error || !result.imageUrl) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      setImageUrl(result.imageUrl);
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="border-border bg-muted relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border sm:w-48">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
          <img src={imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1 text-xs">
            <ImageIcon className="size-6" />
            Aucune image
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${levelCode}`}>Nom</Label>
            <Input
              id={`name-${levelCode}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex : Téléphone"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`value-${levelCode}`}>Valeur (F CFA)</Label>
            <Input
              id={`value-${levelCode}`}
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`description-${levelCode}`}>
            Description (optionnel)
          </Label>
          <Input
            id={`description-${levelCode}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">Récompense enregistrée.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending || !name.trim() || value === ""}
            onClick={handleSave}
          >
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !rewardId}
            title={
              rewardId ? undefined : "Enregistrez d'abord la récompense"
            }
            onClick={() => inputRef.current?.click()}
          >
            {imageUrl ? "Changer l'image" : "Ajouter une image"}
          </Button>
        </div>
      </div>
    </div>
  );
}
