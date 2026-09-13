"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCoursePricingAction } from "./pricing-actions";

export function EditPricingForm({
  courseId,
  currentPrice,
  currentBusinessVolume,
  currentCategory,
}: {
  courseId: string;
  currentPrice: number | null;
  currentBusinessVolume: number | null;
  currentCategory: string | null;
}) {
  const [price, setPrice] = useState(currentPrice?.toString() ?? "");
  const [businessVolume, setBusinessVolume] = useState(
    currentBusinessVolume?.toString() ?? "",
  );
  const [category, setCategory] = useState(currentCategory ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateCoursePricingAction(courseId, {
        price: Number(price),
        businessVolume: Number(businessVolume),
        category: category || undefined,
      });
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-price">Prix (F CFA)</Label>
          <Input
            id="edit-price"
            type="number"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-bv">Business Volume (1 BV = 1 000 F CFA)</Label>
          <Input
            id="edit-bv"
            type="number"
            min={0}
            step={1}
            value={businessVolume}
            onChange={(e) => setBusinessVolume(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-category">Catégorie</Label>
        <Input
          id="edit-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button
        disabled={pending || price === "" || businessVolume === ""}
        onClick={handleSave}
      >
        {pending ? "Enregistrement..." : "Enregistrer le prix"}
      </Button>
    </div>
  );
}
