import "server-only";
import { revalidatePath } from "next/cache";

// The public pages that show courses — the homepage cards, the /formations
// catalog and every /formations/[slug] page — are statically generated and
// otherwise refreshed only every 10 minutes (their `revalidate`). Every
// admin action that changes what a visitor sees of a course calls this,
// so a new thumbnail, a published course or a renamed lesson shows up
// right away instead of after up to 10 minutes.
export function revalidatePublicCourses() {
  revalidatePath("/");
  revalidatePath("/formations", "layout");
  revalidatePath("/sitemap.xml");
}
