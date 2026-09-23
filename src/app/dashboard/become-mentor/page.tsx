import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { findMentorProfileByUserId } from "@/repositories/mentors";
import {
  listMentorReviews,
  listPendingMentorshipRequestsForMentor,
} from "@/repositories/mentorships";
import { requireUser } from "@/services/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StarRatingDisplay } from "@/components/star-rating";
import { RequestMentorForm } from "./request-form";
import { MentorshipRequests } from "./mentorship-requests";

export default async function BecomeMentorPage() {
  const { profile } = await requireUser();
  if (profile.status === "SUSPENDED") redirect("/dashboard");

  const existing = await findMentorProfileByUserId(db, profile.id);

  if (existing?.status === "APPROVED") {
    const [requests, reviews] = await Promise.all([
      listPendingMentorshipRequestsForMentor(db, profile.id),
      listMentorReviews(db, profile.id),
    ]);
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Vous êtes mentor</CardTitle>
            <CardDescription>
              Votre profil est visible dans l&apos;annuaire des mentors, domaine{" "}
              <strong>{existing.category}</strong>.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demandes d&apos;accompagnement</CardTitle>
            <CardDescription>
              Acceptez une demande pour permettre au membre de laisser un avis
              une fois accompagné.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MentorshipRequests requests={requests} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avis reçus</CardTitle>
            {averageRating !== null && (
              <CardDescription className="flex items-center gap-2">
                <StarRatingDisplay rating={averageRating} />
                {averageRating.toFixed(1)} ({reviews.length} avis)
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucun avis pour le moment.
              </p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((review) => (
                  <li key={review.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <StarRatingDisplay rating={review.rating} />
                      <span className="text-muted-foreground text-xs">
                        {review.menteeFullName}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {review.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
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
          defaultCategory={existing?.category}
          defaultPitch={existing?.pitch ?? undefined}
        />
      </CardContent>
    </Card>
  );
}
