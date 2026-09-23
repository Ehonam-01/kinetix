import Link from "next/link";
import { db } from "@/db/client";
import { listDistinctCourseCategories } from "@/repositories/courses";
import { listApprovedMentors } from "@/repositories/mentors";
import { requireUser } from "@/services/auth/current-user";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function MentorsPage(
  props: PageProps<"/dashboard/mentors">,
) {
  const { profile } = await requireUser();
  if (profile.status === "SUSPENDED") return null;

  const { category } = await props.searchParams;
  const categoryFilter =
    typeof category === "string" && category ? category : undefined;

  const [mentors, categories] = await Promise.all([
    listApprovedMentors(db, { category: categoryFilter }),
    listDistinctCourseCategories(db),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mentors</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {mentors.length} mentor{mentors.length > 1 ? "s" : ""} validé
            {mentors.length > 1 ? "s" : ""} — des membres expérimentés prêts à
            accompagner d&apos;autres membres.
          </p>
        </div>
        <Link
          href="/dashboard/become-mentor"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Devenir mentor
        </Link>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row">
        <select
          name="category"
          defaultValue={categoryFilter ?? ""}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] sm:max-w-xs"
        >
          <option value="">Tous les domaines</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border-input hover:bg-muted rounded-lg border px-4 py-1.5 text-sm font-medium"
        >
          Filtrer
        </button>
      </form>

      {mentors.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun mentor pour ce domaine pour le moment.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((mentor) => (
            <Card key={mentor.userId}>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {mentor.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{mentor.fullName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      @{mentor.username}
                      {mentor.country ? ` · ${mentor.country}` : ""}
                    </p>
                  </div>
                </div>

                <span className="bg-primary/10 text-primary inline-block rounded-full px-2.5 py-1 text-xs font-medium">
                  {mentor.category}
                </span>

                {mentor.pitch && (
                  <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                    {mentor.pitch}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
