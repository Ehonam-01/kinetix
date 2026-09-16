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

const PARAMETER_LABEL: Record<string, string> = {
  "commission.level_1_bonus": "Bonus fin de niveau 1",
  "bv.value_in_cfa": "Valeur d'1 point (F CFA)",
  "subscription.price_in_cfa": "Prix de l'abonnement annuel (F CFA)",
  "subscription.business_volume": "Points générés par l'abonnement",
};

export default async function AdminParametersPage() {
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
              <EditParameterForm
                parameterKey={param.parameterKey}
                currentValue={param.value}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
