import { RechargeForm } from "./recharge-form";
import { requireAdmin } from "@/services/auth/current-user";

export default async function AdminRechargePage(
  props: PageProps<"/admin/recharge">,
) {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const { username } = await props.searchParams;
  const initialUsername = typeof username === "string" ? username : "";

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground max-w-lg text-sm">
        Crédite directement le solde disponible d&apos;un membre, hors
        provider de paiement. Un code de confirmation est envoyé à votre
        propre adresse email avant que le crédit ne soit appliqué.
      </p>
      <RechargeForm initialUsername={initialUsername} />
    </div>
  );
}
