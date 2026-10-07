import type { MetadataRoute } from "next";
import { db } from "@/db/client";
import { listPublishedCoursesForMarketing } from "@/repositories/courses";

// Refreshed with the catalog (same 10-minute window as /formations).
export const revalidate = 600;

// The public pages search engines should index — never /dashboard, /admin
// or anything behind a login (see robots.ts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  const courses = await listPublishedCoursesForMarketing(db);
  const pages = [
    "/",
    "/formations",
    "/programme-ambassadeur",
    "/mentions-legales",
    "/conditions-utilisation",
    "/confidentialite",
    "/contact",
  ];
  return [
    ...pages.map((path) => ({ url: `${base}${path}` })),
    ...courses.map((course) => ({
      url: `${base}/formations/${course.slug ?? course.id}`,
    })),
  ];
}
