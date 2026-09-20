"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCoursePricingAction } from "./actions";

export function EditPricingForm({
  courseId,
  currentPrice,
  currentCategory,
}: {
  courseId: string;
  currentPrice: number | null;
  currentCategory: string | null;
}) {
  const [price, setPrice] = useState(currentPrice?.toString() ?? "");
  const [category, setCategory] = useState(currentCategory ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const trimmedPrice = price.trim();
    const parsedPrice = trimmedPrice === "" ? null : Number(trimmedPrice);
    if (parsedPrice !== null && (!Number.isInteger(parsedPrice) || parsedPrice < 0)) {
      setError("Le prix doit être un nombre entier positif.");
      return;
    }
    startTransition(async () => {
      const result = await updateCoursePricingAction(courseId, {
        price: parsedPrice,
        category: category.trim() || null,
      });
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="price">Prix affiché (F CFA, optionnel)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="ex : 50000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Catégorie (optionnel)</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ex : marketing"
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Le prix n&apos;est jamais facturé — il s&apos;affiche à titre indicatif,
        avec la mention « Gratuit avec l&apos;abonnement ».
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button size="sm" variant="outline" disabled={pending} onClick={handleSave}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  );
}
