import { MessageCircle } from "lucide-react";
import { formatWhatsapp, whatsappHref } from "@/lib/whatsapp";
import { requireAdmin } from "@/services/auth/current-user";
import { listTrainerRequestsForAdmin } from "@/services/trainers/trainer-requests";
import { TrainerReviewActions } from "./review-actions";

const fmtDate = (date: Date | null) =>
  date ? date.toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—";

// Applications to become a trainer (dashboard/become-trainer): review each
// proposed course, then approve or refuse with a reason — the member is
// emailed the decision.
export default async function AdminTrainersPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't re-run on
  // every navigation, so it can't be the only gate.
  await requireAdmin();
  const { pending, approved } = await listTrainerRequestsForAdmin();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">
          Candidatures à examiner ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune candidature en attente.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map(({ request, fullName, username, phone }) => (
              <div
                key={request.id}
                className="space-y-3 rounded-2xl border p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {fullName}{" "}
                      <span className="text-muted-foreground">
                        ({username})
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {request.domain} · candidature du{" "}
                      {fmtDate(request.requestedAt)}
                    </p>
                  </div>
                  {phone && (
                    <a
                      href={whatsappHref(
                        phone,
                        `Bonjour ${fullName}, c'est l'équipe Kinetix Africa au sujet de ta candidature de formateur.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1fb857]"
                    >
                      <MessageCircle className="size-3.5" />
                      {formatWhatsapp(phone)}
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <p>
                    <span className="text-muted-foreground">
                      Formation proposée :
                    </span>{" "}
                    <strong>{request.courseTitle}</strong>
                  </p>
                  <div>
                    <p className="text-muted-foreground text-xs">Programme</p>
                    <p className="whitespace-pre-line">
                      {request.courseOutline}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Expérience</p>
                    <p className="whitespace-pre-line">{request.experience}</p>
                  </div>
                  {request.sampleUrl && (
                    <a
                      href={request.sampleUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-primary text-xs break-all underline underline-offset-4"
                    >
                      {request.sampleUrl}
                    </a>
                  )}
                </div>
                <TrainerReviewActions trainerProfileId={request.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          Formateurs validés ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun formateur validé pour le moment.
          </p>
        ) : (
          <div className="divide-y rounded-2xl border">
            {approved.map(({ request, fullName, username }) => (
              <div
                key={request.id}
                className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
              >
                <p>
                  <span className="font-medium">{fullName}</span>{" "}
                  <span className="text-muted-foreground">({username})</span> ·{" "}
                  {request.courseTitle}
                </p>
                <p className="text-muted-foreground">
                  validé le {fmtDate(request.reviewedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
