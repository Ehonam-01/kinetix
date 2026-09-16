"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createDirectSaleRuleAction } from "./actions";

const TYPES = [
  { value: "FIXED", label: "Montant fixe (F CFA)" },
  { value: "PERCENTAGE", label: "% du prix payé" },
  { value: "BV_PERCENTAGE", label: "% du volume généré" },
] as const;

export function NewRuleForm({
  courses,
}: {
  courses: { id: string; title: string }[];
}) {
  const [scope, setScope] = useState<"default" | "course">("default");
  const [courseId, setCourseId] = useState("");
  const [category, setCategory] = useState("");
  const [commissionType, setCommissionType] =
    useState<(typeof TYPES)[number]["value"]>("FIXED");
  const [rateInput, setRateInput] = useState("");
  const [cap, setCap] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const rate =
        commissionType === "FIXED"
          ? Math.round(Number(rateInput))
          : Math.round(Number(rateInput) * 100); // percentage -> basis points

      const result = await createDirectSaleRuleAction({
        courseId: scope === "course" && courseId ? courseId : undefined,
        category: category || undefined,
        commissionType,
        rate,
        cap: cap === "" ? undefined : Number(cap),
      });
      if (result.error) {
        setError(result.error);
      } else {
        setRateInput("");
        setCap("");
      }
    });
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label>Portée</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScope("default")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              scope === "default"
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-background hover:bg-muted",
            )}
          >
            Règle par défaut
          </button>
          <button
            type="button"
            onClick={() => setScope("course")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              scope === "course"
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-background hover:bg-muted",
            )}
          >
            Formation spécifique
          </button>
        </div>
      </div>

      {scope === "course" && (
        <div className="space-y-2">
          <Label htmlFor="course">Formation</Label>
          <select
            id="course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Sélectionner une formation</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="category">Catégorie (optionnel)</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="ex : marketing"
        />
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
          <Label htmlFor="rate">
            {commissionType === "FIXED" ? "Montant (F CFA)" : "Taux (%)"}
          </Label>
          <Input
            id="rate"
            type="number"
            min={0}
            step={commissionType === "FIXED" ? 1 : 0.01}
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cap">Plafond (F CFA, optionnel)</Label>
          <Input
            id="cap"
            type="number"
            min={0}
            step={1}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
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
