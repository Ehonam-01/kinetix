import { PlayCircle, Quote } from "lucide-react";
import { Reveal } from "./reveal";

export type HomeTestimonial = {
  id: string;
  firstName: string;
  city: string | null;
  courseTitle: string | null;
  quote: string;
  photoUrl: string | null;
  videoUrl: string | null;
};

// What members say, between "Commencer est simple" and the pricing section
// (explicit user decision). Only the testimonials an admin entered and
// published in /admin/temoignages — never one written here; with none,
// the section isn't shown at all.
export function TestimonialsSection({
  testimonials,
}: {
  testimonials: HomeTestimonial[];
}) {
  if (testimonials.length === 0) return null;
  return (
    <section id="temoignages" className="scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-brand-accent text-xs font-semibold tracking-widest uppercase">
              Témoignages
            </span>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Ils et elles ont commencé.
            </h2>
          </div>
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <li
              key={t.id}
              className="bg-card flex flex-col gap-4 rounded-3xl border p-6 shadow-sm"
            >
              <Quote aria-hidden="true" className="text-brand-accent size-6" />
              <blockquote className="flex-1 text-base leading-relaxed">
                « {t.quote} »
              </blockquote>
              {t.videoUrl && (
                <a
                  href={t.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1.5 text-sm font-medium"
                >
                  <PlayCircle aria-hidden="true" className="size-4" />
                  Voir la vidéo de {t.firstName}
                </a>
              )}
              <div className="flex items-center gap-3 border-t pt-4">
                {t.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
                  <img
                    src={t.photoUrl}
                    alt={`Photo de ${t.firstName}`}
                    loading="lazy"
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="bg-brand-accent/15 text-brand-accent flex size-12 items-center justify-center rounded-full text-lg font-semibold"
                  >
                    {t.firstName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="text-sm">
                  <p className="font-semibold">
                    {t.firstName}
                    {t.city && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {t.city}
                      </span>
                    )}
                  </p>
                  {t.courseTitle && (
                    <p className="text-muted-foreground">{t.courseTitle}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
