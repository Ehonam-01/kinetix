import { db } from "@/db/client";
import { listApprovedMentors, listPendingMentorRequestsForAdmin } from "@/repositories/mentors";
import { ReviewActions } from "./review-actions";

export default async function AdminMentorsPage() {
  const [requests, approved] = await Promise.all([
    listPendingMentorRequestsForAdmin(db),
    listApprovedMentors(db),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {requests.length} demande(s) en attente de validation.
        </p>

        {requests.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune demande en attente.
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="space-y-2 rounded-2xl border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {r.fullName} (@{r.username}) · {r.category}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Demandé le{" "}
                    {r.requestedAt.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}
                  </p>
                  {r.pitch && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {r.pitch}
                    </p>
                  )}
                </div>
                <ReviewActions mentorProfileId={r.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {approved.length} mentor(s) validé(s) et visible(s) dans
          l&apos;annuaire.
        </p>
        {approved.length > 0 && (
          <div className="space-y-3">
            {approved.map((m) => (
              <div
                key={m.userId}
                className="space-y-1 rounded-2xl border px-4 py-3 text-sm"
              >
                <p className="font-medium">
                  {m.fullName} (@{m.username}) · {m.category}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
