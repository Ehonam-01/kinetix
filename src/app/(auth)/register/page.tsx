import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ sponsor?: string }>;
}) {
  const { sponsor } = await searchParams;

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
        <RegisterForm defaultSponsorUsername={sponsor} />
      </CardContent>
    </Card>
  );
}
