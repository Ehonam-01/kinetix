import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { requireUser } from "@/services/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JoinAmbassadorForm } from "./join-form";

export default async function BecomeAmbassadorPage(
  props: PageProps<"/dashboard/become-ambassador">,
) {
  const { profile } = await requireUser();
  if (profile.status === "SUSPENDED") redirect("/dashboard");

  const existing = await db.query.ambassadorProfiles.findFirst({
    where: eq(ambassadorProfiles.userId, profile.id),
  });
  if (existing) redirect("/dashboard");

  const { sponsor } = await props.searchParams;
  const defaultSponsorUsername =
    typeof sponsor === "string" ? sponsor : undefined;

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Devenir ambassadeur</CardTitle>
        <CardDescription>
          Gratuit. Vous gardez l&apos;accès à votre abonnement quoi qu&apos;il
          arrive — rejoindre le programme ajoute un lien de parrainage, une
          équipe et des commissions sur les souscriptions que vous apportez.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <JoinAmbassadorForm defaultSponsorUsername={defaultSponsorUsername} />
      </CardContent>
    </Card>
  );
}
