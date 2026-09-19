import Link from "next/link";
import { requireUser } from "@/services/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CommunityProfileForm } from "./community-profile-form";
import { DeleteAccountForm } from "./delete-account-form";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

// Same labels as admin/members/page.tsx — PENDING_PAYMENT's real meaning
// since the education-first pivot is "hasn't joined the ambassador
// program", not "hasn't paid" (see MLM_RULES.md).
const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Client (non-ambassadeur)",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
};

export default async function SettingsPage() {
  const { authUser, profile } = await requireUser();

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            {authUser.email} ·{" "}
            {profile.role === "ADMIN" ? "Administrateur" : "Membre"} ·{" "}
            {STATUS_LABEL[profile.status] ?? profile.status}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            fullName={profile.fullName}
            username={profile.username}
            phone={profile.phone ?? ""}
            country={profile.country ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profil communautaire</CardTitle>
          <CardDescription>
            Visible par les autres membres dans{" "}
            <Link href="/dashboard/community" className="underline">
              l&apos;annuaire
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommunityProfileForm
            bio={profile.bio ?? ""}
            goal={profile.goal ?? ""}
            skills={profile.skills ?? []}
            directoryVisible={profile.directoryVisible}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
          <CardDescription>
            Changez le mot de passe utilisé pour vous connecter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Zone de danger</CardTitle>
          <CardDescription>
            Supprimer définitivement votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
