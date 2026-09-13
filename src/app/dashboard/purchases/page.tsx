import { db } from "@/db/client";
import { listPurchasesForBuyer } from "@/repositories/sales";
import { requireUser } from "@/services/auth/current-user";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmée",
  REFUNDED: "Remboursée",
};

export default async function PurchasesPage() {
  const { profile } = await requireUser();
  const purchases = await listPurchasesForBuyer(db, profile.id);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {purchases.length} achat(s)
      </p>

      {purchases.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun achat pour le moment.
        </p>
      ) : (
        <div className="divide-y rounded-2xl border">
          {purchases.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{p.courseTitle}</p>
                <p className="text-muted-foreground text-xs">
                  {p.createdAt.toLocaleDateString("fr-FR", {
                    dateStyle: "medium",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span>{p.pricePaid.toLocaleString("fr-FR")} F</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    p.status === "CONFIRMED" &&
                      "bg-green-600/10 text-green-600",
                    p.status === "REFUNDED" && "bg-primary/10 text-primary",
                  )}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
