import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { slugify } from "@/lib/utils";
import { logAdminAction } from "@/services/admin/audit-log";

// Admin-only, role re-checked inside the transaction (defense in depth, same
// convention as grantAdminCredit/updateRewardDeliveryStatus).
//
// Every course is public to browse and buy — no more level-gating (explicit
// business rule confirmed by the user; hasCourseAccess no longer reads
// course_levels at all, see repositories/courses.ts), so this no longer
// takes levelCodes. price/businessVolume stay optional: a course can exist
// without being for sale yet (never invented here). slug is auto-derived
// from the title when omitted, same rule as migration 0022's SQL backfill
// (see lib/utils.ts's slugify), so every course created from now on gets
// one without the admin having to think about URLs.
export async function createCourse(
  adminUserId: string,
  input: {
    title: string;
    description?: string;
    price?: number;
    businessVolume?: number;
    category?: string;
  },
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut créer un cours.");
    }

    const [course] = await tx
      .insert(courses)
      .values({
        title: input.title,
        slug: slugify(input.title),
        description: input.description,
        price: input.price,
        businessVolume: input.businessVolume,
        category: input.category,
      })
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_CREATED",
      targetType: "course",
      targetId: course.id,
      metadata: { title: input.title },
    });

    return course;
  });
}
