"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCoursePricingAction } from "./actions";

export function EditPricingForm({
  courseId,
  currentPrice,
  currentSalePrice,
  currentCategory,
}: {
  courseId: string;
  currentPrice: number | null;
  currentSalePrice: number | null;
  currentCategory: string | null;
}) {
  const [price, setPrice] = useState(currentPrice?.toString() ?? "");
  const [salePrice, setSalePrice] = useState(
    currentSalePrice?.toString() ?? "",
  );
  const [saved, setSaved] = useState(false);
  const [category, setCategory] = useState(currentCategory ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    const trimmedSale = salePrice.trim();
    const parsedSale = trimmedSale === "" ? null : Number(trimmedSale);
    const trimmedPrice = price.trim();
    const parsedPrice = trimmedPrice === "" ? null : Number(trimmedPrice);
    if (
      parsedPrice !== null &&
      (!Number.isInteger(parsedPrice) || parsedPrice < 0)
    ) {
      setError("Le prix doit être un nombre entier positif.");
      return;
    }
    startTransition(async () => {
      const result = await updateCoursePricingAction(courseId, {
        price: parsedPrice,
        salePrice: parsedSale,
        category: category.trim() || null,
      });
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="price">Prix affiché (F CFA, optionnel)</Label>
          <Input
            id="price"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
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
        Le prix affiché n&apos;est jamais facturé — il s&apos;affiche à titre
        indicatif, avec la mention « Gratuit avec l&apos;abonnement ».
      </p>
      <div className="space-y-2">
        <Label htmlFor="sale-price">
          Prix à l&apos;unité (F CFA, optionnel)
        </Label>
        <Input
          id="sale-price"
          inputMode="numeric"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value.replace(/\D/g, ""))}
          placeholder="Vide : vendue seulement avec l'abonnement"
        />
        <p className="text-muted-foreground text-xs">
          Ce que paie quelqu&apos;un qui achète seulement cette formation :
          accès à vie, sans devenir membre. Vide : la formation n&apos;est pas
          vendue seule.
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
