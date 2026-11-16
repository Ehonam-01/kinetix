import { Quote } from "lucide-react";

export type PublicTestimonial = {
  id: string;
  kind: "TEXT" | "IMAGE";
  authorName: string | null;
  authorDetail: string | null;
  body: string | null;
  imageUrl: string | null;
};

// What participants of a past session said (managed from /admin/atelier,
// only real ones): written reviews and screenshots of messages, mixed in
// the admin's order, in columns that fill like a wall. Nothing at all
// until one is published.
export function Testimonials({
  testimonials,
  className,
}: {
  testimonials: PublicTestimonial[];
  className?: string;
}) {
  if (testimonials.length === 0) return null;
  return (
    <section className={className}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Ce qu&apos;en disent les participants
        </h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-center text-pretty">
          Les retours de ceux qui ont suivi la première session.
        </p>
        <ul className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {testimonials.map((t) => (
            <li
              key={t.id}
              className="bg-card mb-4 break-inside-avoid rounded-2xl border p-4"
            >
              {t.kind === "IMAGE" && t.imageUrl ? (
                <a
                  href={t.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Voir la capture en grand"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx) */}
                  <img
                    src={t.imageUrl}
                    alt={
                      t.authorName
                        ? `Message de ${t.authorName}`
                        : "Message d'un participant"
                    }
                    loading="lazy"
                    className="w-full rounded-lg border"
                  />
                </a>
              ) : (
                <blockquote className="relative pl-7 text-sm leading-relaxed sm:text-base">
                  <Quote
                    aria-hidden="true"
                    className="text-brand-accent absolute top-0.5 left-0 size-5"
                  />
                  <p className="whitespace-pre-line">{t.body}</p>
                </blockquote>
              )}
              {(t.authorName || t.authorDetail) && (
                <p className="mt-3 text-sm">
                  {t.authorName && (
                    <span className="font-semibold">{t.authorName}</span>
                  )}
                  {t.authorName && t.authorDetail && (
                    <span className="text-muted-foreground"> · </span>
                  )}
                  {t.authorDetail && (
                    <span className="text-muted-foreground">
                      {t.authorDetail}
                    </span>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
