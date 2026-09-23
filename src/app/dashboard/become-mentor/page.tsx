import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { listDistinctCourseCategories } from "@/repositories/courses";
import { findMentorProfileByUserId } from "@/repositories/mentors";
import { requireUser } from "@/services/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequestMentorForm } from "./request-form";

export default async function BecomeMentorPage() {
  const { profile } = await requireUser();
  if (profile.status === "SUSPENDED") redirect("/dashboard");

  const [existing, categories] = await Promise.all([
    findMentorProfileByUserId(db, profile.id),
    listDistinctCourseCategories(db),
  ]);

  if (existing?.status === "APPROVED") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Vous êtes mentor</CardTitle>
          <CardDescription>
            Votre profil est visible dans l&apos;annuaire des mentors, domaine{" "}
            <strong>{existing.category}</strong>.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (existing?.status === "PENDING_REVIEW") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Demande en cours d&apos;examen</CardTitle>
          <CardDescription>
            Votre demande pour devenir mentor en{" "}
            <strong>{existing.category}</strong> est en attente de validation
            par un administrateur.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Devenir mentor</CardTitle>
        <CardDescription>
          Gratuit. Déclarez un domaine dans lequel vous pouvez accompagner
          d&apos;autres membres — un administrateur valide chaque demande
          avant que votre profil n&apos;apparaisse dans l&apos;annuaire des
          mentors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {existing?.status === "REJECTED" && (
          <p className="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-lg border p-3 text-sm">
            Votre précédente demande a été refusée
            {existing.rejectionReason ? ` : ${existing.rejectionReason}` : "."}{" "}
            Vous pouvez soumettre une nouvelle demande ci-dessous.
          </p>
        )}
        <RequestMentorForm
          categories={categories}
          defaultCategory={existing?.category}
          defaultPitch={existing?.pitch ?? undefined}
        />
      </CardContent>
    </Card>
  );
}
