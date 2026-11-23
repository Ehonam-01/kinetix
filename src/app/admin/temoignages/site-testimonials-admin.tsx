"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resizeImageForUpload } from "@/lib/resize-image";
import { cn } from "@/lib/utils";
import {
  addSiteTestimonialAction,
  deleteSiteTestimonialAction,
  moveSiteTestimonialAction,
  setSiteTestimonialPublishedAction,
} from "./actions";

export type AdminSiteTestimonial = {
  id: string;
  firstName: string;
  city: string | null;
  courseTitle: string | null;
  quote: string;
  photoUrl: string | null;
  videoUrl: string | null;
  isPublished: boolean;
};

export function SiteTestimonialsAdmin({
  testimonials,
}: {
  testimonials: AdminSiteTestimonial[];
}) {
  return (
    <div className="space-y-4">
      <AddForm />
      {testimonials.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun témoignage.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Item
              key={t.id}
              testimonial={t}
              first={i === 0}
              last={i === testimonials.length - 1}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const FIELDS = [
  ["firstName", "Prénom", "Ama"],
  ["city", "Ville (optionnel)", "Lomé"],
  [
    "courseTitle",
    "Formation suivie (optionnel)",
    "Montage vidéo pro avec CapCut",
  ],
  ["videoUrl", "Vidéo YouTube (optionnel)", "https://youtube.com/shorts/..."],
] as const;

function AddForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const photo = formData.get("photo");
      if (photo instanceof File && photo.size > 0) {
        try {
          // Phone photos can exceed what a Server Action accepts.
          formData.set("photo", await resizeImageForUpload(photo));
        } catch {
          setMessage("La photo n'a pas pu être préparée. Essaie une autre.");
          return;
        }
      }
      const result = await addSiteTestimonialAction(formData);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      formRef.current?.reset();
      setMessage("Témoignage ajouté.");
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([name, label, placeholder]) => (
          <div key={name} className="space-y-1.5">
            <Label htmlFor={`site-testimonial-${name}`}>{label}</Label>
            <Input
              id={`site-testimonial-${name}`}
              name={name}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="site-testimonial-quote">
          Citation (courte, 400 caractères au plus)
        </Label>
        <textarea
          id="site-testimonial-quote"
          name="quote"
          rows={3}
          placeholder="Ce que le membre a dit, mot pour mot."
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="site-testimonial-photo">Photo (optionnel)</Label>
        <input
          id="site-testimonial-photo"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm"
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Uniquement de vrais témoignages, avec l&apos;accord du membre pour sa
        photo et ses mots.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi..." : "Ajouter"}
        </Button>
        {message && <p className="text-sm">{message}</p>}
      </div>
    </form>
  );
}

function Item({
  testimonial: t,
  first,
  last,
}: {
  testimonial: AdminSiteTestimonial;
  first: boolean;
  last: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <li
      className={cn(
        "bg-card flex flex-col gap-3 rounded-2xl border p-3",
        !t.isPublished && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        {t.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
          <img
            src={t.photoUrl}
            alt={`Photo de ${t.firstName}`}
            className="size-12 rounded-full object-cover"
          />
        )}
        <p className="text-sm">
          <span className="font-medium">{t.firstName}</span>
          {t.city && <span className="text-muted-foreground"> · {t.city}</span>}
          {t.courseTitle && (
            <span className="text-muted-foreground block text-xs">
              {t.courseTitle}
            </span>
          )}
        </p>
      </div>
      <p className="line-clamp-5 text-sm">« {t.quote} »</p>
      {t.videoUrl && (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Video className="size-3.5" /> Avec une vidéo
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending || first}
          aria-label="Monter"
          onClick={() => run(() => moveSiteTestimonialAction(t.id, "up"))}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending || last}
          aria-label="Descendre"
          onClick={() => run(() => moveSiteTestimonialAction(t.id, "down"))}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(() => setSiteTestimonialPublishedAction(t.id, !t.isPublished))
          }
        >
          {t.isPublished ? <EyeOff /> : <Eye />}
          {t.isPublished ? "Masquer" : "Publier"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive ml-auto"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Supprimer ce témoignage ?")) {
              run(() => deleteSiteTestimonialAction(t.id));
            }
          }}
        >
          <Trash2 />
          Supprimer
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </li>
  );
}
