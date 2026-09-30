import { GenerateCourseForm } from "./generate-course-form";
import { requireAdmin } from "@/services/auth/current-user";

// A full course of Markdown articles takes Claude a few minutes to write —
// this also sets the timeout of the generate Server Action used here.
export const maxDuration = 300;

export default async function GenerateCoursePage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Générer un cours avec l&apos;IA
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Claude propose un plan complet (modules, leçons, articles et quiz pour
          les leçons texte) à partir d&apos;un simple sujet.
        </p>
      </div>
      <GenerateCourseForm />
    </div>
  );
}
