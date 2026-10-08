import { MessageCircle } from "lucide-react";
import { goalLabel } from "@/config/goals";
import {
  LEVEL_OPTIONS,
  optionLabel,
  SITUATION_OPTIONS,
  WEEKLY_TIME_OPTIONS,
} from "@/config/orientation";
import { formatWhatsapp, whatsappHref } from "@/lib/whatsapp";
import { requireAdmin } from "@/services/auth/current-user";
import { listOrientationRequestsForAdmin } from "@/services/orientation/orientation-requests";
import { HandledButton } from "./handled-button";

const fmtDate = (date: Date | null) =>
  date ? date.toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—";

// Orientation questionnaires sent by members (dashboard/mentors/
// orientation): answer them on WhatsApp, then mark them handled.
export default async function AdminOrientationPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't re-run on
  // every navigation, so it can't be the only gate.
  await requireAdmin();
  const { pending, handled } = await listOrientationRequestsForAdmin();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">À traiter ({pending.length})</h2>
        <p className="text-muted-foreground text-sm">
          Des membres qui cherchent leur direction. Contactez-les sur WhatsApp
          pour leur conseiller des formations ou un mentor, puis marquez la
          demande comme traitée.
        </p>
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune demande en attente.
          </p>
        ) : (
          <div className="divide-y rounded-2xl border">
            {pending.map(({ request, fullName, username, phone, country }) => (
              <div
                key={request.id}
                className="flex flex-col gap-3 px-4 py-4 text-sm sm:flex-row sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {fullName}{" "}
                    <span className="text-muted-foreground">
                      ({username}){country ? ` · ${country}` : ""}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Envoyée le {fmtDate(request.createdAt)}
                  </p>
                  <dl className="grid gap-x-4 gap-y-1 pt-1 sm:grid-cols-[auto_1fr]">
                    <dt className="text-muted-foreground">Objectif</dt>
                    <dd className="font-medium">{goalLabel(request.goal)}</dd>
                    <dt className="text-muted-foreground">Situation</dt>
                    <dd>{optionLabel(SITUATION_OPTIONS, request.situation)}</dd>
                    <dt className="text-muted-foreground">Niveau</dt>
                    <dd>{optionLabel(LEVEL_OPTIONS, request.level)}</dd>
                    <dt className="text-muted-foreground">Disponibilité</dt>
                    <dd>
                      {optionLabel(WEEKLY_TIME_OPTIONS, request.weeklyTime)}
                    </dd>
                    <dt className="text-muted-foreground">Intérêts</dt>
                    <dd className="break-words">{request.interests}</dd>
                  </dl>
                  {request.message && (
                    <p className="bg-muted/50 mt-2 rounded-lg px-3 py-2 break-words whitespace-pre-line">
                      {request.message}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  {phone ? (
                    <a
                      href={whatsappHref(
                        phone,
                        `Bonjour ${fullName}, c'est l'équipe Kinetix Africa suite à ta demande d'orientation.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1fb857]"
                    >
                      <MessageCircle className="size-3.5" />
                      {formatWhatsapp(phone)}
                    </a>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Pas de numéro WhatsApp
                    </p>
                  )}
                  <HandledButton requestId={request.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {handled.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Traitées ({handled.length})</h2>
          <div className="divide-y rounded-2xl border">
            {handled.map(({ request, fullName, username }) => (
              <div
                key={request.id}
                className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
              >
                <p>
                  {fullName}{" "}
                  <span className="text-muted-foreground">({username})</span> ·{" "}
                  {goalLabel(request.goal)}
                </p>
                <p className="text-muted-foreground">
                  traitée le {fmtDate(request.handledAt)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
