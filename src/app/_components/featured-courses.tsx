import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { MarketingCourseSummary } from "@/repositories/courses";
import { CourseCard } from "./course-card";
import { Reveal } from "./reveal";

export function FeaturedCourses({
  courses,
}: {
  courses: MarketingCourseSummary[];
}) {
  return (
    <section id="formations" className="scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Les formations : la base de tout.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Chaque trajectoire solide commence par des compétences concrètes.
              Nos formations sont pensées pour être appliquées tout de suite,
              pas seulement regardées.
            </p>
          </div>
        </Reveal>

        {courses.length === 0 ? (
          <Reveal delayMs={100}>
            <div className="border-border bg-card mx-auto mt-12 flex max-w-lg flex-col items-center gap-3 rounded-2xl border p-10 text-center">
              <Sparkles className="text-primary size-8" />
              <p className="font-medium">
                De nouvelles formations arrivent très bientôt.
              </p>
              <p className="text-muted-foreground text-sm">
                Rejoignez-nous dès maintenant pour être informé dès leur mise en
                ligne.
              </p>
              <Link href="/register" className={cn(buttonVariants(), "mt-2")}>
                Nous rejoindre
              </Link>
            </div>
          </Reveal>
        ) : (
          <>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course, i) => (
                <Reveal key={course.id} delayMs={i * 80}>
                  <CourseCard course={course} />
                </Reveal>
              ))}
            </div>
            <div className="mt-10 text-center">
              <a
                href="#formations"
                className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                Voir toutes les formations
                <ArrowRight className="size-4" />
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
