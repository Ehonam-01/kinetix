import Link from "next/link";
import { cookies } from "next/headers";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REFERRAL_COOKIE_NAME,
  resolveReferralUsername,
} from "@/services/attribution/resolve-referral";
import { db } from "@/db/client";
import { getPublicCourse } from "@/repositories/courses";
import { formatPrice } from "@/lib/format-price";
import { splitTranches } from "@/lib/split-payment";
import { getLaunchOffer } from "@/services/pricing/launch-offer";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ sponsor?: string; formation?: string }>;
}) {
  const { sponsor, formation } = await searchParams;
  // ?formation=<slug>: signing up to buy that course on its own (a learner
  // account, explicit user decision), only for a course sold that way.
  const course = formation ? await getPublicCourse(db, formation) : null;
  const learnerCourse =
    course?.course.slug && course.course.salePrice !== null
      ? course.course
      : null;
  // ?sponsor= (an explicit sponsor-specific registration link) wins when
  // present; otherwise, prefill from the visitor's own referral-link cookie
  // if any — so a click-through visitor isn't left with no sponsorships row
  // at all just because they never knew to type a pseudo themselves.
  // The subscription and paying it in 3 times (lib/split-payment.ts), said
  // before the account is made: the payment itself comes after.
  const { price } = await getLaunchOffer(db);
  const tranches = splitTranches(price);
  const defaultSponsorUsername =
    sponsor ??
    (await resolveReferralUsername(
      (await cookies()).get(REFERRAL_COOKIE_NAME)?.value,
    )) ??
    undefined;

  return (
    <RegisterForm
      defaultSponsorUsername={defaultSponsorUsername}
      formation={learnerCourse?.slug ?? undefined}
      header={
        <CardHeader>
          <CardTitle>
            {learnerCourse ? "Crée ton compte" : "Nous rejoindre"}
          </CardTitle>
          {learnerCourse && (
            <CardDescription>
              Pour acheter « {learnerCourse.title} » et la retrouver quand tu
              veux. Tu paies juste après avoir confirmé ton adresse email.
            </CardDescription>
          )}
          {!learnerCourse && (
            <CardDescription>
              Abonnement annuel : {formatPrice(price)} en une fois
              {tranches && (
                <>
                  , ou en 3 fois (selon ton pays) :{" "}
                  <strong className="text-foreground">
                    {formatPrice(tranches[0])} aujourd&apos;hui
                  </strong>
                  , puis{" "}
                  {tranches[1] === tranches[2]
                    ? `2 × ${formatPrice(tranches[1])}`
                    : `${formatPrice(tranches[1])} et ${formatPrice(tranches[2])}`}{" "}
                  dans les 3 mois
                </>
              )}
              . Tu choisis au moment du paiement, juste après
              l&apos;inscription.
            </CardDescription>
          )}
          <CardDescription>
            Déjà inscrit ?{" "}
            <Link
              href={
                learnerCourse
                  ? `/login?next=${encodeURIComponent(`/formations/${learnerCourse.slug}/acheter`)}`
                  : "/login"
              }
              className="text-primary underline underline-offset-4"
            >
              Se connecter
            </Link>
          </CardDescription>
        </CardHeader>
      }
    />
  );
}
