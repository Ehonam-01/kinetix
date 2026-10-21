import { redirect } from "next/navigation";
import { CheckCircle2, Clock, Presentation } from "lucide-react";
import { requireUser } from "@/services/auth/current-user";
import { findTrainerProfileByUserId } from "@/services/trainers/trainer-requests";
import { TrainerRequestForm } from "./request-form";

// Becoming a trainer: apply with the course you'd teach; the team reviews
// it (admin/trainers) and, once accepted, builds the course with you.
export default async function BecomeTrainerPage() {
  const { profile } = await requireUser();
  if (profile.status === "SUSPENDED") redirect("/dashboard");
  const existing = await findTrainerProfileByUserId(profile.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="bg-brand-accent/10 text-brand-accent flex size-11 shrink-0 items-center justify-center rounded-xl">
          <Presentation className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Devenir formateur</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tu maîtrises un sujet qui peut aider d&apos;autres membres ? Propose
            ta formation : l&apos;équipe Kinetix Africa examine chaque
            candidature et t&apos;accompagne ensuite pour la préparer et la
            mettre en ligne.
          </p>
        </div>
      </div>

      {existing?.status === "APPROVED" ? (
        <div className="space-y-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Tu es formateur Kinetix Africa
          </p>
          <p className="text-sm">
            Ta formation « <strong>{existing.courseTitle}</strong> » (
            {existing.domain}) est validée. L&apos;équipe te contacte sur
            WhatsApp pour la préparer avec toi : programme, enregistrement des
            leçons et mise en ligne.
          </p>
        </div>
      ) : existing?.status === "PENDING_REVIEW" ? (
        <div className="space-y-2 rounded-2xl border p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Clock className="text-brand-accent size-5" />
            Candidature en cours d&apos;examen
          </p>
          <p className="text-muted-foreground text-sm">
            Ta proposition « <strong>{existing.courseTitle}</strong> » a été
            envoyée le{" "}
            {existing.requestedAt.toLocaleDateString("fr-FR", {
              dateStyle: "long",
            })}
            . Tu recevras la réponse par email.
          </p>
        </div>
      ) : (
        <div className="border-border bg-card space-y-4 rounded-2xl border p-5 sm:p-6">
          {existing?.status === "REJECTED" && (
            <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
              Ta précédente candidature n&apos;a pas été retenue
              {existing.rejectionReason
                ? ` : ${existing.rejectionReason}`
                : "."}{" "}
              Tu peux en déposer une nouvelle ci-dessous.
            </p>
          )}
          <TrainerRequestForm
            defaults={
              existing
                ? {
                    domain: existing.domain,
                    courseTitle: existing.courseTitle,
                    courseOutline: existing.courseOutline,
                    experience: existing.experience,
                    sampleUrl: existing.sampleUrl ?? "",
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
