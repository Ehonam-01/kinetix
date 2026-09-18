import { Wallet } from "lucide-react";
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
      <div className="flex items-center gap-4 rounded-2xl border bg-blue-50 p-5 dark:bg-blue-500/10">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
          <Wallet className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Solde disponible
          </p>
          <p className="text-3xl font-bold wrap-break-word">
            {balance.availableBalance.toLocaleString("fr-FR")} F
          </p>
        </div>
      </div>
      <TransferForm />
    </div>
  );
}
