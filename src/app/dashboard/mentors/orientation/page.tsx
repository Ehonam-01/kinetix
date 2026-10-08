import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { goalLabel, isGoalValue } from "@/config/goals";
import { requireUser } from "@/services/auth/current-user";
import { getLatestOrientationRequest } from "@/services/orientation/orientation-requests";
import { buttonVariants } from "@/components/ui/button";
import { formatWhatsapp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { OrientationForm } from "./orientation-form";

// The orientation questionnaire: for a member who doesn't know which course
// or mentor to pick. It goes to the team (admin → Orientation), who answers
// on the member's WhatsApp.
export default async function OrientationPage() {
  const { profile } = await requireUser();
  if (profile.status === "SUSPENDED") return null;

  const latest = await getLatestOrientationRequest(profile.id);
  const pending = latest?.status === "NEW" ? latest : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trouver ma direction</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Réponds à quelques questions : l&apos;équipe Kinetix Africa étudie ta
          situation et te recontacte sur WhatsApp pour te conseiller les
          formations et le mentor adaptés.
        </p>
      </div>

      {pending ? (
        <div className="border-border bg-card space-y-3 rounded-2xl border p-5 sm:p-6">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5 text-green-600" />
            Ta demande a bien été envoyée
          </p>
          <p className="text-muted-foreground text-sm">
            Envoyée le{" "}
            {pending.createdAt.toLocaleDateString("fr-FR", {
              dateStyle: "long",
            })}{" "}
            · objectif : {goalLabel(pending.goal)}. L&apos;équipe te répond sur
            WhatsApp
            {profile.phone ? ` (${formatWhatsapp(profile.phone)})` : ""}.
          </p>
          <Link
            href="/dashboard/mentors"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            En attendant, découvrir les mentors
          </Link>
        </div>
      ) : (
        <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
          <OrientationForm
            defaultGoal={isGoalValue(profile.goal) ? profile.goal : ""}
          />
        </div>
      )}

      {!profile.phone && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Ajoute ton numéro WhatsApp dans{" "}
          <Link
            href="/dashboard/settings"
            className="font-medium underline underline-offset-4"
          >
            Paramètres
          </Link>{" "}
          pour que l&apos;équipe puisse te répondre.
        </p>
      )}
    </div>
  );
}
