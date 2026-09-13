import { GenerateCourseForm } from "./generate-course-form";

export default function GenerateCoursePage() {
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
