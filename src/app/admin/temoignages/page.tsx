import { db } from "@/db/client";
import { requireAdmin } from "@/services/auth/current-user";
import { listSiteTestimonials } from "@/services/site/testimonials";
import { SiteTestimonialsAdmin } from "./site-testimonials-admin";

// The members' testimonials shown on the homepage, between "Commencer est
// simple" and the pricing section (services/site/testimonials.ts).
export default async function AdminTestimonialsPage() {
  await requireAdmin();
  const testimonials = await listSiteTestimonials(db, { publishedOnly: false });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Témoignages de l&apos;accueil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Affichés sur la page d&apos;accueil, dans cet ordre. La section reste
          masquée tant qu&apos;aucun témoignage n&apos;est publié.
        </p>
      </div>
      <SiteTestimonialsAdmin
        testimonials={testimonials.map((t) => ({
          id: t.id,
          firstName: t.firstName,
          city: t.city,
          courseTitle: t.courseTitle,
          quote: t.quote,
          photoUrl: t.photoUrl,
          videoUrl: t.videoUrl,
          isPublished: t.isPublished,
        }))}
      />
    </div>
  );
}
