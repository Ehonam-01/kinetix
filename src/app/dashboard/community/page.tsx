import { db } from "@/db/client";
import { GOAL_OPTIONS, goalLabel } from "@/config/goals";
import { listCommunityMembers } from "@/repositories/community";
import { requireUser } from "@/services/auth/current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function CommunityPage(
  props: PageProps<"/dashboard/community">,
) {
  const { profile } = await requireUser();
  if (profile.status === "SUSPENDED") return null;

  const { q, goal } = await props.searchParams;
  const search = typeof q === "string" ? q.trim() : undefined;
  const goalFilter = typeof goal === "string" && goal ? goal : undefined;

  const members = await listCommunityMembers(db, {
    search,
    goal: goalFilter,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Communauté</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {members.length} membre{members.length > 1 ? "s" : ""} — trouve
          d&apos;autres personnes qui partagent tes ambitions.
        </p>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Rechercher un pseudo ou un nom..."
          className="sm:max-w-xs"
        />
        <select
          name="goal"
          defaultValue={goalFilter ?? ""}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] sm:max-w-xs"
        >
          <option value="">Tous les objectifs</option>
          {GOAL_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
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

      {members.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Personne ici pour le moment. Essaie une autre recherche, ou sois le
          premier à compléter ton profil communautaire.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {member.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.fullName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      @{member.username}
                      {member.country ? ` · ${member.country}` : ""}
                    </p>
                  </div>
                </div>

                {goalLabel(member.goal) && (
                  <span className="bg-primary/10 text-primary inline-block rounded-full px-2.5 py-1 text-xs font-medium">
                    {goalLabel(member.goal)}
                  </span>
                )}

                {member.bio && (
                  <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                    {member.bio}
                  </p>
                )}

                {member.skills && member.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills.map((skill) => (
                      <span
                        key={skill}
                        className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
