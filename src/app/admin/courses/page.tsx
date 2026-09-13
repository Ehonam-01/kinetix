import Link from "next/link";
import { db } from "@/db/client";
import { listAllCoursesForAdmin } from "@/repositories/courses";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminCoursesPage() {
  const courses = await listAllCoursesForAdmin(db);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{courses.length} cours</p>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/courses/generate"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Générer avec l&apos;IA
          </Link>
          <Link
            href="/admin/courses/new"
            className={buttonVariants({ size: "sm" })}
          >
            Nouveau cours
          </Link>
        </div>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun cours.</p>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Link key={course.id} href={`/admin/courses/${course.id}`}>
              <Card className="hover:bg-muted/50 flex-row items-center gap-4 pr-4 transition-colors">
                <div className="bg-muted ml-6 aspect-video w-24 shrink-0 overflow-hidden rounded-lg">
                  {course.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
                    <img
                      src={course.thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <CardHeader className="px-0">
                    <CardTitle>
                      {course.title}
                      {!course.isActive && " (inactif)"}
                    </CardTitle>
                    {course.description && (
                      <CardDescription>{course.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="text-muted-foreground px-0 text-sm">
                    {course.moduleCount} module(s) · {course.lessonCount}{" "}
                    leçon(s)
                  </CardContent>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
