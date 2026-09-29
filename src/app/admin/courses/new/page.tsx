import { NewCourseForm } from "./new-course-form";
import { requireAdmin } from "@/services/auth/current-user";

export default async function NewCoursePage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nouveau cours</h1>
      <NewCourseForm />
    </div>
  );
}
