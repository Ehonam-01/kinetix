import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/services/auth/current-user";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewTicketPage() {
  await requireUser();
  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/dashboard/support"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Mes tickets
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Nouveau ticket</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          L&apos;équipe te répond ici, et tu reçois un email à chaque réponse.
        </p>
      </div>
      <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <NewTicketForm />
      </div>
    </div>
  );
}
