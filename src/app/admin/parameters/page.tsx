import { db } from "@/db/client";
import { listCurrentParameters } from "@/repositories/parameter-versions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EditParameterForm } from "./edit-parameter-form";
import { requireAdmin } from "@/services/auth/current-user";

const PARAMETER_LABEL: Record<string, string> = {
  "commission.level_1_bonus": "Bonus fin de niveau 1",
  "bv.value_in_cfa": "Valeur d'1 point (F CFA)",
  "subscription.price_in_cfa": "Prix de l'abonnement annuel (F CFA)",
  "subscription.regular_price_in_cfa":
    "Tarif normal annoncé après le lancement (F CFA)",
  "subscription.business_volume": "Points générés par l'abonnement",
  "withdrawal.minimum_amount": "Montant minimum de retrait (F CFA)",
  "withdrawal.fee_percent_bp": "Frais de retrait : pourcentage du montant",
  "withdrawal.fee_fixed": "Frais de retrait : montant fixe (F CFA)",
};

// How the value is typed and shown: most parameters are plain integers;
// a percentage is stored in basis points (150 = 1,5 %) but edited as a
// percentage with decimals.
const PARAMETER_UNIT: Record<string, "percent_bp"> = {
  "withdrawal.fee_percent_bp": "percent_bp",
};

const PARAMETER_HINT: Record<string, string> = {
  "subscription.regular_price_in_cfa":
    "Affiché barré sur la page d'accueil, avec la mention « Prix de lancement ». Jamais facturé. Mettez 0 (ou une valeur égale au prix actuel) pour retirer la mention à la fin du lancement.",
  "withdrawal.fee_percent_bp":
    "Déduit du montant retiré, cumulé avec le montant fixe. Ex. 1,5 % + 100 F sur un retrait de 10 000 F : le membre reçoit 9 750 F.",
  "withdrawal.fee_fixed":
    "Déduit de chaque retrait, en plus du pourcentage. 0 = pas de frais fixes.",
};

export default async function AdminParametersPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const parameters = await listCurrentParameters(db);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Modifier une valeur crée une nouvelle version à partir de maintenant —
        aucune commission déjà versée n&apos;est recalculée (non-rétroactivité,
        voir MLM_RULES.md).
      </p>

      <div className="space-y-3">
        {parameters.map((param) => (
          <Card key={param.id}>
            <CardHeader>
              <CardTitle>
                {PARAMETER_LABEL[param.parameterKey] ?? param.parameterKey}
              </CardTitle>
              <CardDescription>
                {param.parameterKey} · effectif depuis le{" "}
                {param.effectiveFrom.toLocaleDateString("fr-FR", {
                  dateStyle: "medium",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {PARAMETER_HINT[param.parameterKey] && (
                <p className="text-muted-foreground mb-3 text-xs">
                  {PARAMETER_HINT[param.parameterKey]}
                </p>
              )}
              <EditParameterForm
                parameterKey={param.parameterKey}
                currentValue={param.value}
                unit={PARAMETER_UNIT[param.parameterKey]}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
