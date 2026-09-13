import { NewCourseForm } from "./new-course-form";

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nouveau cours</h1>
      <NewCourseForm />
    </div>
  );
}
