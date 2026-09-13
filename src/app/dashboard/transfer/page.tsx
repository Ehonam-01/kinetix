import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { getBalance } from "@/repositories/financial-transactions";
import { requireUser } from "@/services/auth/current-user";
import { TransferForm } from "./transfer-form";

export default async function TransferPage() {
  const { profile } = await requireUser();
  if (profile.status !== "ACTIVE") redirect("/dashboard");

  const balance = await getBalance(db, profile.id);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Solde disponible : {balance.availableBalance.toLocaleString("fr-FR")} F
      </p>
      <TransferForm />
    </div>
  );
}
