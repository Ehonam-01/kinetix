import { db } from "@/db/client";
import { listSalesForAdmin } from "@/repositories/sales";
import { cn } from "@/lib/utils";
import { RefundButton } from "./refund-button";

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmée",
  REFUNDED: "Remboursée",
};

export default async function AdminSalesPage() {
  const sales = await listSalesForAdmin(db);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{sales.length} vente(s)</p>

      {sales.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune vente.</p>
      ) : (
        <div className="space-y-3">
          {sales.map((s) => (
            <div key={s.id} className="space-y-2 rounded-2xl border px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.courseTitle}</p>
                  <p className="text-muted-foreground text-xs">
                    Acheteur : {s.buyerUsername}
                    {s.ambassadorUsername &&
                      ` · attribuée à ${s.ambassadorUsername}`}
                    {" · "}
                    {s.createdAt.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    {s.pricePaid.toLocaleString("fr-FR")} F ·{" "}
                    {s.businessVolume.toLocaleString("fr-FR")} BV
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      s.status === "CONFIRMED" &&
                        "bg-green-600/10 text-green-600",
                      s.status === "REFUNDED" &&
                        "bg-primary/10 text-primary",
                    )}
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>
              </div>
              {s.status === "CONFIRMED" && <RefundButton saleId={s.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
