import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/db/client";
import { getPublicCourse } from "@/repositories/courses";
import { SITE_NAME } from "@/config/site";
import { PublicCourseView } from "./public-course-view";

// Every page is generated on its first visit, then served statically and
// refreshed at most every 10 minutes (ISR) — same window as the homepage
// and /formations. An empty list is what turns ISR on for paths only known
// at runtime (generateStaticParams docs, "All paths at runtime").
export const revalidate = 600;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata(
  props: PageProps<"/formations/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const content = await getPublicCourse(db, slug);
  if (!content) return { title: `Formation introuvable — ${SITE_NAME}` };
  const { course } = content;
  const title = `${course.title} — ${SITE_NAME}`;
  const description =
    course.description ??
    `Une formation ${SITE_NAME}, incluse dans l'abonnement annuel.`;
  const path = `/formations/${course.slug ?? course.id}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "fr_FR",
      type: "website",
      ...(course.thumbnailUrl ? { images: [course.thumbnailUrl] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(course.thumbnailUrl ? { images: [course.thumbnailUrl] } : {}),
    },
  };
}

export default async function PublicCoursePage(
  props: PageProps<"/formations/[slug]">,
) {
  const { slug } = await props.params;
  const content = await getPublicCourse(db, slug);
  if (!content) notFound();
  const { course } = content;

  // Reached by id (a referral link, a course without a slug yet): send
  // visitors and search engines to the one canonical address.
  if (course.slug && slug !== course.slug) {
    permanentRedirect(`/formations/${course.slug}`);
  }

  return <PublicCourseView content={content} />;
}
