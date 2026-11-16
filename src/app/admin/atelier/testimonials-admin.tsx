"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resizeImageForUpload } from "@/lib/resize-image";
import { cn } from "@/lib/utils";
import {
  addImageTestimonialAction,
  addTextTestimonialAction,
  deleteTestimonialAction,
  moveTestimonialAction,
  setTestimonialPublishedAction,
} from "./actions";

export type AdminTestimonial = {
  id: string;
  kind: "TEXT" | "IMAGE";
  authorName: string | null;
  authorDetail: string | null;
  body: string | null;
  imageUrl: string | null;
  isPublished: boolean;
};

// The participants' testimonials shown on the sales page: a written review,
// or a screenshot of a message received.
export function TestimonialsAdmin({
  testimonials,
}: {
  testimonials: AdminTestimonial[];
}) {
  return (
    <div className="space-y-4">
      <AddTestimonialForm />
      {testimonials.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun témoignage. La section reste masquée sur la page de vente tant
          qu&apos;aucun n&apos;est publié.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <TestimonialItem
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

function AddTestimonialForm() {
  const [kind, setKind] = useState<"TEXT" | "IMAGE">("TEXT");
  const [authorName, setAuthorName] = useState("");
  const [authorDetail, setAuthorDetail] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setAuthorName("");
    setAuthorDetail("");
    setBody("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      let result: { error: string | null };
      if (kind === "TEXT") {
        result = await addTextTestimonialAction({
          authorName,
          authorDetail,
          body,
        });
      } else {
        if (!file) {
          setMessage("Choisis une capture d'écran.");
          return;
        }
        const formData = new FormData();
        try {
          // Phone screenshots can exceed what a Server Action accepts.
          formData.set("image", await resizeImageForUpload(file));
        } catch {
          setMessage("L'image n'a pas pu être préparée. Essaie une autre.");
          return;
        }
        formData.set("authorName", authorName);
        formData.set("authorDetail", authorDetail);
        result = await addImageTestimonialAction(formData);
      }
      if (result.error) {
        setMessage(result.error);
        return;
      }
      reset();
      setMessage("Témoignage ajouté.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border p-4">
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {(
          [
            ["TEXT", "Avis écrit"],
            ["IMAGE", "Capture WhatsApp"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              kind === value
                ? "border-primary bg-primary/10 font-medium"
                : "border-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="testimonial-name">
            Nom du participant{kind === "IMAGE" ? " (optionnel)" : ""}
          </Label>
          <Input
            id="testimonial-name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Ama K."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="testimonial-detail">
            Ville, métier ou session (optionnel)
          </Label>
          <Input
            id="testimonial-detail"
            value={authorDetail}
            onChange={(e) => setAuthorDetail(e.target.value)}
            placeholder="Commerçante, Lomé"
          />
        </div>
      </div>

      {kind === "TEXT" ? (
        <div className="space-y-1.5">
          <Label htmlFor="testimonial-body">Témoignage</Label>
          <textarea
            id="testimonial-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ce que le participant a dit, mot pour mot."
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="testimonial-image">Capture d&apos;écran</Label>
          <input
            id="testimonial-image"
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <p className="text-muted-foreground text-xs">
            Pense à masquer les numéros de téléphone avant l&apos;envoi.
          </p>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Uniquement de vrais témoignages, avec l&apos;accord du participant.
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

function TestimonialItem({
  testimonial: t,
  first,
  last,
}: {
  testimonial: AdminTestimonial;
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
      {t.kind === "IMAGE" && t.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
        <img
          src={t.imageUrl}
          alt={t.authorName ? `Message de ${t.authorName}` : "Capture"}
          className="max-h-64 w-full rounded-lg border object-contain"
        />
      ) : (
        <p className="line-clamp-6 text-sm">« {t.body} »</p>
      )}
      {(t.authorName || t.authorDetail) && (
        <p className="text-xs">
          <span className="font-medium">{t.authorName}</span>
          {t.authorName && t.authorDetail && " · "}
          <span className="text-muted-foreground">{t.authorDetail}</span>
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending || first}
          aria-label="Monter"
          onClick={() => run(() => moveTestimonialAction(t.id, "up"))}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={pending || last}
          aria-label="Descendre"
          onClick={() => run(() => moveTestimonialAction(t.id, "down"))}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(() => setTestimonialPublishedAction(t.id, !t.isPublished))
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
              run(() => deleteTestimonialAction(t.id));
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
