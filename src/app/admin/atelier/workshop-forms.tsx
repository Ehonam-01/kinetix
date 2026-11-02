"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addWorkshopRegistrationAction,
  updateWorkshopSettingsAction,
} from "./actions";

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

export function WorkshopSettingsForm({
  current,
}: {
  current: {
    priceCfa: number;
    regularPriceCfa: number;
    capacity: number;
    venue: string;
    whatsappGroupUrl: string | null;
    exampleVideoUrls: string[];
    heroVideoUrl: string | null;
    sliderVideoUrls: string[];
    registrationsOpen: boolean;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [values, setValues] = useState({
    priceCfa: String(current.priceCfa),
    regularPriceCfa: String(current.regularPriceCfa),
    capacity: String(current.capacity),
    venue: current.venue,
    whatsappGroupUrl: current.whatsappGroupUrl ?? "",
    heroVideoUrl: current.heroVideoUrl ?? "",
  });
  const [videos, setVideos] = useState(
    [0, 1, 2].map((i) => current.exampleVideoUrls[i] ?? ""),
  );
  // One link per line: easier than a field per video for a list of any
  // length.
  const [sliderVideos, setSliderVideos] = useState(
    current.sliderVideoUrls.join("\n"),
  );
  const [registrationsOpen, setRegistrationsOpen] = useState(
    current.registrationsOpen,
  );

  const set =
    (field: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: event.target.value }));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateWorkshopSettingsAction({
        ...values,
        exampleVideoUrls: videos,
        sliderVideoUrls: sliderVideos.split("\n"),
        registrationsOpen,
      });
      setMessage(result.error ?? "Enregistré.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="workshop-price"
          label="Prix (F CFA)"
          type="number"
          value={values.priceCfa}
          onChange={set("priceCfa")}
        />
        <Field
          id="workshop-regular"
          label="Prix barré (F CFA)"
          type="number"
          value={values.regularPriceCfa}
          onChange={set("regularPriceCfa")}
        />
        <Field
          id="workshop-capacity"
          label="Places"
          type="number"
          value={values.capacity}
          onChange={set("capacity")}
        />
      </div>
      <Field
        id="workshop-venue"
        label="Lieu"
        value={values.venue}
        onChange={set("venue")}
      />
      <Field
        id="workshop-group"
        label="Lien du groupe WhatsApp des participants"
        placeholder="https://chat.whatsapp.com/..."
        value={values.whatsappGroupUrl}
        onChange={set("whatsappGroupUrl")}
      />
      <Field
        id="workshop-hero-video"
        label="Vidéo horizontale sous le haut de page (lien YouTube)"
        placeholder="https://www.youtube.com/watch?v=..."
        value={values.heroVideoUrl}
        onChange={set("heroVideoUrl")}
      />
      {videos.map((url, i) => (
        <Field
          key={i}
          id={`workshop-video-${i}`}
          label={`Vidéo d'exemple ${i + 1} (lien YouTube)`}
          placeholder="https://www.youtube.com/shorts/..."
          value={url}
          onChange={(e) =>
            setVideos((v) => v.map((u, j) => (j === i ? e.target.value : u)))
          }
        />
      ))}
      <div className="space-y-1.5">
        <Label htmlFor="workshop-slider-videos">
          Slider de vidéos exemples (un lien YouTube par ligne, 12 au plus)
        </Label>
        <textarea
          id="workshop-slider-videos"
          rows={5}
          placeholder={
            "https://www.youtube.com/shorts/...\nhttps://www.youtube.com/shorts/..."
          }
          value={sliderVideos}
          onChange={(e) => setSliderVideos(e.target.value)}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
        />
        <p className="text-muted-foreground text-xs">
          Sous « Ce que tu vas réaliser ». Les vidéos se lisent sans le son ; un
          tap relance la vidéo avec le son. Vide : le slider est masqué.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={registrationsOpen}
          onChange={(e) => setRegistrationsOpen(e.target.checked)}
        />
        Inscriptions en ligne ouvertes
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "..." : "Enregistrer"}
        </Button>
        {message && <p className="text-sm">{message}</p>}
      </div>
    </form>
  );
}

const EMPTY_REGISTRATION = {
  fullName: "",
  whatsapp: "",
  email: "",
  city: "",
  amount: "",
};

// For someone who wrote on WhatsApp once the online sale stopped.
export function AddRegistrationForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [values, setValues] = useState(EMPTY_REGISTRATION);

  const set =
    (field: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: event.target.value }));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await addWorkshopRegistrationAction(values);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setValues(EMPTY_REGISTRATION);
      setMessage("Participant ajouté.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="add-name"
          label="Nom complet"
          required
          value={values.fullName}
          onChange={set("fullName")}
        />
        <Field
          id="add-whatsapp"
          label="Numéro WhatsApp"
          required
          value={values.whatsapp}
          onChange={set("whatsapp")}
        />
        <Field
          id="add-city"
          label="Ville"
          required
          value={values.city}
          onChange={set("city")}
        />
        <Field
          id="add-email"
          label="E-mail (optionnel)"
          type="email"
          value={values.email}
          onChange={set("email")}
        />
        <Field
          id="add-amount"
          label="Montant reçu (F CFA)"
          type="number"
          required
          value={values.amount}
          onChange={set("amount")}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "..." : "Ajouter"}
        </Button>
        {message && <p className="text-sm">{message}</p>}
      </div>
    </form>
  );
}
