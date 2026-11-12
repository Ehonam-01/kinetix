import { db } from "@/db/client";
import {
  getCurrentParameterValueOrNull,
  getScheduledParameterVersion,
  listCurrentParameters,
} from "@/repositories/parameter-versions";
import {
  lastLaunchDayLabel,
  PRICE_KEY,
  REGULAR_PRICE_KEY,
} from "@/services/pricing/launch-offer";
import { LaunchEndForm } from "./launch-end-form";
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
  "subscription.regular_price_in_cfa": "Prix barré (F CFA)",
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

// Shown together in the "Tarif de l'abonnement" card at the top, so left
// out of the list below.
const PRICE_CARD_KEYS = new Set([PRICE_KEY, REGULAR_PRICE_KEY]);

const PARAMETER_HINT: Record<string, string> = {
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
  const [parameters, scheduled, price, regularPrice] = await Promise.all([
    listCurrentParameters(db),
    getScheduledParameterVersion(db, PRICE_KEY),
    getCurrentParameterValueOrNull(db, PRICE_KEY),
    getCurrentParameterValueOrNull(db, REGULAR_PRICE_KEY),
  ]);
  const struckThrough =
    price !== null && regularPrice !== null && regularPrice > price;
  const scheduledEnd = scheduled
    ? {
        value: scheduled.value,
        // The last day at the current price: the day before the new one.
        lastDay: new Date(scheduled.effectiveFrom.getTime() - 1)
          .toISOString()
          .slice(0, 10),
        lastDayLabel: lastLaunchDayLabel(scheduled.effectiveFrom.toISOString()),
      }
    : null;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Modifier une valeur crée une nouvelle version à partir de maintenant —
        aucune commission déjà versée n&apos;est recalculée (non-rétroactivité,
        voir MLM_RULES.md).
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Tarif de l&apos;abonnement</CardTitle>
          <CardDescription>
            Le prix barré s&apos;affiche à côté du prix sur la page
            d&apos;accueil, la page Business Plan et les écrans de paiement,
            avec la mention « Prix de lancement ». Il n&apos;est jamais facturé.
            Mettez 0 pour ne rien barrer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Prix (F CFA)</p>
              <EditParameterForm
                parameterKey={PRICE_KEY}
                currentValue={price ?? 0}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Prix barré (F CFA)</p>
              <EditParameterForm
                parameterKey={REGULAR_PRICE_KEY}
                currentValue={regularPrice ?? 0}
              />
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Affiché aux visiteurs :{" "}
            </span>
            {struckThrough && (
              <span className="text-muted-foreground mr-2 line-through">
                {regularPrice!.toLocaleString("fr-FR")} F
              </span>
            )}
            <span className="font-semibold">
              {(price ?? 0).toLocaleString("fr-FR")} F
            </span>
            {!struckThrough && (
              <span className="text-muted-foreground">
                {" "}
                (aucun prix barré : il doit être plus élevé que le prix)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-brand-accent/40">
        <CardHeader>
          <CardTitle>Fin du prix de lancement</CardTitle>
          <CardDescription>
            Le prix change tout seul le lendemain du dernier jour, à minuit
            (GMT). D&apos;ici là, la page d&apos;accueil, la page Business Plan
            et l&apos;écran de paiement affichent un compte à rebours et
            l&apos;économie réalisée, et les inscrits non payés ainsi que les
            ambassadeurs reçoivent un rappel par email 7 jours, 3 jours et le
            dernier jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LaunchEndForm
            defaultPrice={regularPrice && regularPrice > 0 ? regularPrice : 0}
            scheduled={scheduledEnd}
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {parameters
          .filter((param) => !PRICE_CARD_KEYS.has(param.parameterKey))
          .map((param) => (
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
