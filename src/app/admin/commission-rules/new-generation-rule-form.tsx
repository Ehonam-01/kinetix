"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createGenerationRuleAction } from "./actions";

const TYPES = [
  { value: "FIXED", label: "Montant fixe × taille de la génération" },
  {
    value: "PERCENTAGE",
    label: "% du prix de l'abonnement × taille de la génération",
  },
  { value: "BV_PERCENTAGE", label: "% du volume généré par la génération" },
] as const;

const LEVELS = [2, 3, 4, 5];

export function NewGenerationRuleForm() {
  const [levelCode, setLevelCode] = useState(2);
  const [generation, setGeneration] = useState(1);
  const [commissionType, setCommissionType] =
    useState<(typeof TYPES)[number]["value"]>("FIXED");
  const [rateInput, setRateInput] = useState("");
  const [cap, setCap] = useState("");
  const [requirePresence, setRequirePresence] = useState(true);
  const [minimumBv, setMinimumBv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const rate =
        commissionType === "FIXED"
          ? Math.round(Number(rateInput))
          : Math.round(Number(rateInput) * 100); // percentage -> basis points

      const result = await createGenerationRuleAction({
        levelCode,
        generation,
        commissionType,
        rate,
        cap: cap === "" ? undefined : Number(cap),
        requirePresence,
        minimumBv: minimumBv === "" ? undefined : Number(minimumBv),
      });
      if (result.error) {
        setError(result.error);
      } else {
        setRateInput("");
        setCap("");
        setMinimumBv("");
      }
    });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Niveau</Label>
          <div className="flex gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevelCode(l)}
                className={cn(
                  "h-8 w-8 rounded-md border text-sm font-medium",
                  levelCode === l
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-background hover:bg-muted",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Génération</Label>
          <div className="flex gap-2">
            {[1, 2, 3].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGeneration(g)}
                className={cn(
                  "h-8 w-8 rounded-md border text-sm font-medium",
                  generation === g
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-background hover:bg-muted",
                )}
              >
                G{g}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Type de commission</Label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setCommissionType(t.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                commissionType === t.value
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-background hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gen-rate">
            {commissionType === "FIXED"
              ? "Montant par personne (F CFA)"
              : "Taux (%)"}
          </Label>
          <Input
            id="gen-rate"
            type="number"
            min={0}
            step={commissionType === "FIXED" ? 1 : 0.01}
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gen-cap">Plafond (F CFA, optionnel)</Label>
          <Input
            id="gen-cap"
            type="number"
            min={0}
            step={1}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Condition de qualification</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requirePresence}
            onChange={(e) => setRequirePresence(e.target.checked)}
          />
          Exiger l&apos;effectif complet de la génération (comme
          aujourd&apos;hui)
        </label>
        <div className="space-y-2">
          <Label htmlFor="gen-min-bv">Points minimum requis (optionnel)</Label>
          <Input
            id="gen-min-bv"
            type="number"
            min={0}
            step={1}
            value={minimumBv}
            onChange={(e) => setMinimumBv(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending || rateInput === ""} onClick={handleCreate}>
        {pending ? "Création..." : "Créer la règle"}
      </Button>
    </div>
  );
}
