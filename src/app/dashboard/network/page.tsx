import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { levels, type LevelConfig } from "@/db/schema/levels";
import { listLevelProgress } from "@/repositories/member-levels";
import {
  getAncestorNames,
  getNetworkView,
  searchDownlineMembers,
} from "@/repositories/network";
import { requireUser } from "@/services/auth/current-user";
import { GenealogyTree } from "./genealogy-tree";
import { LevelSelector } from "./level-selector";

export default async function NetworkPage(
  props: PageProps<"/dashboard/network">,
) {
  const { profile } = await requireUser();
  if (profile.status !== "ACTIVE") redirect("/dashboard");

  const { level, q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const [allLevels, viewerLevels] = await Promise.all([
    db.query.levels.findMany({ orderBy: asc(levels.code) }),
    listLevelProgress(db, profile.id),
  ]);

  const viewerCurrentLevel =
    viewerLevels.filter((l) => l.status !== "LOCKED").at(-1)?.code ?? 1;
  const requestedLevel = typeof level === "string" ? Number(level) : NaN;
  // A level's own genealogy stays locked until the viewer has reached it
  // themselves — checked here too, not just hidden in the UI, since a
  // ?level=N in the URL is trivial to type by hand.
  const selectedLevel =
    allLevels.some((l) => l.code === requestedLevel) &&
    requestedLevel <= viewerCurrentLevel
      ? requestedLevel
      : viewerCurrentLevel;

  const selectedLevelConfig = allLevels.find((l) => l.code === selectedLevel);
  const maxDepth =
    (selectedLevelConfig?.config as LevelConfig | undefined)?.generationSizes
      .length ?? 2;

  const levelNameByCode = Object.fromEntries(
    allLevels.map((l) => [l.code, l.name]),
  );

  const [network, ancestors, searchResults] = await Promise.all([
    getNetworkView(db, profile.id, maxDepth),
    getAncestorNames(db, profile.id),
    query ? searchDownlineMembers(db, profile.id, query) : Promise.resolve([]),
  ]);

  // A single unambiguous match is shown as its own subtree (still fully
  // within the viewer's downline, so no new access-control concern — see
  // searchDownlineMembers) rather than just a name/level row. Several
  // matches stay a plain list: rendering N full subtrees at once wouldn't
  // read as a search result anymore.
  const searchedMember =
    query && searchResults.length === 1 ? searchResults[0] : null;
  const searchedMemberNetwork = searchedMember
    ? await getNetworkView(db, searchedMember.userId, maxDepth)
    : null;

  if (!network) {
    return (
      <p className="text-muted-foreground text-sm">
        Vous n&apos;êtes pas encore placé dans l&apos;arbre binaire.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <LevelSelector
        levels={allLevels}
        selectedLevel={selectedLevel}
        viewerCurrentLevel={viewerCurrentLevel}
      />

      {query && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            {searchResults.length} résultat(s) pour « {q} » dans votre réseau
          </p>
          {!searchedMember && searchResults.length > 0 && (
            <div className="divide-y rounded-2xl border">
              {searchResults.map((r) => (
                <div
                  key={r.userId}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.username}</p>
                    <p className="text-muted-foreground text-xs">
                      {r.fullName} · génération {r.relativeGeneration}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {r.currentLevelCode
                      ? `${levelNameByCode[r.currentLevelCode]} (niveau ${r.currentLevelCode})`
                      : "Aucun niveau"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {searchedMember && searchedMemberNetwork ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{searchedMember.username}</p>
              <p className="text-muted-foreground text-xs">
                {searchedMember.fullName} · génération{" "}
                {searchedMember.relativeGeneration} par rapport à vous
              </p>
            </div>
            <span className="text-muted-foreground text-xs">
              {searchedMember.currentLevelCode
                ? `${levelNameByCode[searchedMember.currentLevelCode]} (niveau ${searchedMember.currentLevelCode})`
                : "Aucun niveau"}
            </span>
          </div>
          <GenealogyTree
            network={searchedMemberNetwork}
            maxDepth={maxDepth}
            selectedLevel={selectedLevel}
            levelNameByCode={levelNameByCode}
          />
        </div>
      ) : (
        <>
          {ancestors.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Au-dessus de vous dans l&apos;arbre :{" "}
              {ancestors.map((a) => a.username).join(" → ")}
            </p>
          )}
          <GenealogyTree
            network={network}
            maxDepth={maxDepth}
            selectedLevel={selectedLevel}
            levelNameByCode={levelNameByCode}
          />
        </>
      )}
    </div>
  );
}
