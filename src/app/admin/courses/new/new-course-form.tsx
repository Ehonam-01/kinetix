"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCourseAction } from "./actions";

export function NewCourseForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [businessVolume, setBusinessVolume] = useState("");
  const [category, setCategory] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Titre</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">
            Prix (F CFA, vide = pas encore en vente)
          </Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bv">Business Volume (1 BV = 1 000 F CFA)</Label>
          <Input
            id="bv"
            type="number"
            min={0}
            step={1}
            value={businessVolume}
            onChange={(e) => setBusinessVolume(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Catégorie (optionnel)</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>
      <Button
        disabled={pending || title.trim() === ""}
        onClick={() =>
          startTransition(() =>
            createCourseAction({
              title,
              description: description || undefined,
              price: price === "" ? undefined : Number(price),
              businessVolume:
                businessVolume === "" ? undefined : Number(businessVolume),
              category: category || undefined,
            }),
          )
        }
      >
        {pending ? "Création..." : "Créer le cours"}
      </Button>
    </div>
  );
}
