import { db } from "@/db/client";
import { listCommissionEvents } from "@/repositories/commission-events";
import { requireAdmin } from "@/services/auth/current-user";

const TYPE_LABEL: Record<string, string> = {
  DIRECT: "Commission directe",
  LEVEL_1_BONUS: "Bonus fin de niveau 1",
  LEVEL_COMMISSION: "Commission de génération",
};

export default async function AdminCommissionsPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const events = await listCommissionEvents(db);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {events.length} commission(s)
      </p>

      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune commission.</p>
      ) : (
        <div className="divide-y rounded-2xl border">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{e.beneficiaryName}</p>
                <p className="text-muted-foreground text-xs">
                  {TYPE_LABEL[e.type] ?? e.type}
                  {e.levelCode && ` · niveau ${e.levelCode}`}
                  {e.generation && ` · génération ${e.generation}`}
                  {e.sourceName && ` · source : ${e.sourceName}`}
                  {" · "}
                  {e.createdAt.toLocaleDateString("fr-FR", {
                    dateStyle: "medium",
                  })}
                </p>
              </div>
              <span className="text-green-600">
                +{e.amount.toLocaleString("fr-FR")} F
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
