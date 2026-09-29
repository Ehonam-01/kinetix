import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { db } from "@/db/client";
import { listPublishedCoursesForMarketing } from "@/repositories/courses";
import { SITE_NAME } from "@/config/site";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CatalogGrid } from "./catalog-grid";

const TITLE = `Toutes les formations — ${SITE_NAME}`;
const DESCRIPTION =
  "Des formations pratiques, pensées pour être appliquées tout de suite. Toutes incluses dans l'abonnement annuel.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/formations" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/formations",
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website",
  },
};

// Same ISR window as the homepage: a course an admin publishes shows up
// here within 10 minutes, while the page is still served statically.
export const revalidate = 600;

export default async function FormationsPage() {
  const courses = await listPublishedCoursesForMarketing(db);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Toutes les formations
        </h1>
        <p className="text-muted-foreground mt-5 text-lg leading-relaxed text-pretty">
          Des compétences concrètes, pensées pour être appliquées tout de suite.
          Chaque formation est incluse dans l&apos;abonnement annuel.
        </p>
      </div>

      <div className="mt-12">
        {courses.length === 0 ? (
          <div className="border-border bg-card mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border p-10 text-center">
            <Sparkles className="text-primary size-8" />
            <p className="font-medium">
              De nouvelles formations arrivent très bientôt.
            </p>
            <Link href="/register" className={cn(buttonVariants(), "mt-2")}>
              Nous rejoindre
            </Link>
          </div>
        ) : (
          <CatalogGrid courses={courses} />
        )}
      </div>
    </section>
  );
}
