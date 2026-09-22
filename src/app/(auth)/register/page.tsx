import Link from "next/link";
import { cookies } from "next/headers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  REFERRAL_COOKIE_NAME,
  resolveReferralUsername,
} from "@/services/attribution/resolve-referral";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ sponsor?: string }>;
}) {
  const { sponsor } = await searchParams;
  // ?sponsor= (an explicit sponsor-specific registration link) wins when
  // present; otherwise, prefill from the visitor's own referral-link cookie
  // if any — so a click-through visitor isn't left with no sponsorships row
  // at all just because they never knew to type a pseudo themselves.
  const defaultSponsorUsername =
    sponsor ??
    (await resolveReferralUsername(
      (await cookies()).get(REFERRAL_COOKIE_NAME)?.value,
    )) ??
    undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nous rejoindre</CardTitle>
        <CardDescription>
          Déjà inscrit ?{" "}
          <Link
            href="/login"
            className="text-primary underline underline-offset-4"
          >
            Se connecter
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm defaultSponsorUsername={defaultSponsorUsername} />
      </CardContent>
    </Card>
  );
}
