"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addWorkshopRegistrationAction,
  markWorkshopBalancePaidAction,
  updateWorkshopPageAction,
  updateWorkshopSessionAction,
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

// The sales page's videos, shared by every city.
export function WorkshopPageForm({
  current,
}: {
  current: {
    exampleVideoUrls: string[];
    heroVideoUrl: string | null;
    sliderVideoUrls: string[];
    sliderVideoTitles: string[];
  };
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [heroVideoUrl, setHeroVideoUrl] = useState(current.heroVideoUrl ?? "");
  const [videos, setVideos] = useState(
    [0, 1, 2].map((i) => current.exampleVideoUrls[i] ?? ""),
  );
  // One line per video, "link | title": easier than fields per video for a
  // list of any length.
  const [sliderVideos, setSliderVideos] = useState(
    current.sliderVideoUrls
      .map((url, i) =>
        current.sliderVideoTitles[i]
          ? `${url} | ${current.sliderVideoTitles[i]}`
          : url,
      )
      .join("\n"),
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateWorkshopPageAction({
        heroVideoUrl,
        exampleVideoUrls: videos,
        sliderVideoUrls: sliderVideos.split("\n"),
      });
      setMessage(result.error ?? "Enregistré.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border p-4">
      <Field
        id="workshop-hero-video"
        label="Vidéo horizontale sous le haut de page (lien YouTube)"
        placeholder="https://www.youtube.com/watch?v=..."
        value={heroVideoUrl}
        onChange={(e) => setHeroVideoUrl(e.target.value)}
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
          Slider de vidéos exemples (une vidéo par ligne : lien YouTube | titre,
          12 au plus)
        </Label>
        <textarea
          id="workshop-slider-videos"
          rows={5}
          placeholder={
            "https://www.youtube.com/shorts/... | Pub pour une boutique\nhttps://www.youtube.com/shorts/... | Promo Black Friday"
          }
          value={sliderVideos}
          onChange={(e) => setSliderVideos(e.target.value)}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
        />
        <p className="text-muted-foreground text-xs">
          Sous « Ce que tu vas réaliser ». Le titre, après la barre « | », est
          affiché sous la vidéo (facultatif, 80 caractères au plus). Les vidéos
          se lisent sans le son ; un tap relance la vidéo avec le son. Vide : le
          slider est masqué.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "..." : "Enregistrer"}
        </Button>
        {message && <p className="text-sm">{message}</p>}
      </div>
    </form>
  );
}

// Lomé time is UTC: the date and hours are read and typed as such.
const toDay = (iso: string) => iso.slice(0, 10);
const toTime = (iso: string) => iso.slice(11, 16);

// One city's session: date and hours, place, price, seats, group, sale.
export function WorkshopSessionForm({
  session,
}: {
  session: {
    id: string;
    city: string | null;
    startsAt: string;
    endsAt: string;
    priceCfa: number;
    regularPriceCfa: number;
    capacity: number;
    venue: string;
    whatsappGroupUrl: string | null;
    registrationsOpen: boolean;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [values, setValues] = useState({
    city: session.city ?? "",
    day: toDay(session.startsAt),
    startTime: toTime(session.startsAt),
    endTime: toTime(session.endsAt),
    priceCfa: String(session.priceCfa),
    regularPriceCfa: String(session.regularPriceCfa),
    capacity: String(session.capacity),
    venue: session.venue,
    whatsappGroupUrl: session.whatsappGroupUrl ?? "",
  });
  const [registrationsOpen, setRegistrationsOpen] = useState(
    session.registrationsOpen,
  );
  const id = (name: string) => `session-${session.id}-${name}`;

  const set =
    (field: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: event.target.value }));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateWorkshopSessionAction(session.id, {
        ...values,
        registrationsOpen,
      });
      setMessage(result.error ?? "Enregistré.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Field
          id={id("city")}
          label="Ville"
          value={values.city}
          onChange={set("city")}
        />
        <Field
          id={id("day")}
          label="Date"
          type="date"
          value={values.day}
          onChange={set("day")}
        />
        <Field
          id={id("start")}
          label="Début (heure de Lomé)"
          type="time"
          value={values.startTime}
          onChange={set("startTime")}
        />
        <Field
          id={id("end")}
          label="Fin"
          type="time"
          value={values.endTime}
          onChange={set("endTime")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id={id("price")}
          label="Prix (F CFA)"
          type="number"
          value={values.priceCfa}
          onChange={set("priceCfa")}
        />
        <Field
          id={id("regular")}
          label="Prix barré (F CFA)"
          type="number"
          value={values.regularPriceCfa}
          onChange={set("regularPriceCfa")}
        />
        <Field
          id={id("capacity")}
          label="Places"
          type="number"
          value={values.capacity}
          onChange={set("capacity")}
        />
      </div>
      <Field
        id={id("venue")}
        label="Lieu (vide : la page affiche le nom de la ville)"
        value={values.venue}
        onChange={set("venue")}
      />
      <Field
        id={id("group")}
        label="Lien du groupe WhatsApp des participants de cette ville"
        placeholder="https://chat.whatsapp.com/..."
        value={values.whatsappGroupUrl}
        onChange={set("whatsappGroupUrl")}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={registrationsOpen}
          onChange={(e) => setRegistrationsOpen(e.target.checked)}
        />
        Inscriptions en ligne ouvertes pour cette ville
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
  amount: "",
};

// For someone who wrote on WhatsApp once the online sale stopped, for the
// session shown.
export function AddRegistrationForm({ workshopId }: { workshopId: string }) {
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
      const result = await addWorkshopRegistrationAction({
        ...values,
        workshopId,
      });
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

// The rest of a seat, received at the door: one tap, confirmed first.
export function BalancePaidButton({
  registrationId,
  left,
}: {
  registrationId: string;
  left: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Confirmer que les ${left.toLocaleString("fr-FR")} F restants ont été reçus ?`,
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await markWorkshopBalancePaidAction(registrationId);
            if (result.error) setError(result.error);
          });
        }}
      >
        Solde reçu sur place
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
