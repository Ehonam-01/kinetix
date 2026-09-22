import { db } from "@/db/client";
import {
  listEffectiveDirectSaleRules,
  listEffectiveGenerationRules,
} from "@/repositories/commission-rules";
import { listAllCoursesForAdmin } from "@/repositories/courses";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { NewGenerationRuleForm } from "./new-generation-rule-form";
import { NewRuleForm } from "./new-rule-form";

function describeDirectSaleRule(
  rule: Awaited<ReturnType<typeof listEffectiveDirectSaleRules>>[number],
) {
  switch (rule.commissionType) {
    case "FIXED":
      return `${rule.rate.toLocaleString("fr-FR")} F`;
    case "PERCENTAGE":
      return `${(rule.rate / 100).toLocaleString("fr-FR")} % du prix payé`;
    case "BV_PERCENTAGE":
      return `${(rule.rate / 100).toLocaleString("fr-FR")} % du volume généré`;
  }
}

function describeGenerationRule(
  rule: Awaited<ReturnType<typeof listEffectiveGenerationRules>>[number],
) {
  const amountLabel =
    rule.commissionType === "FIXED"
      ? `${rule.rate.toLocaleString("fr-FR")} F / personne`
      : rule.commissionType === "PERCENTAGE"
        ? `${(rule.rate / 100).toLocaleString("fr-FR")} % du prix de l'abonnement / personne`
        : `${(rule.rate / 100).toLocaleString("fr-FR")} % du volume généré par la génération`;
  const req = rule.qualificationRequirement;
  const conditions = [
    req?.presence !== false && "effectif complet",
    req?.minBv != null && `volume ≥ ${req.minBv.toLocaleString("fr-FR")} pts`,
  ].filter(Boolean);
  return { amount: amountLabel, conditions: conditions.join(" et ") };
}

export default async function AdminCommissionRulesPage() {
  const [directSaleRules, generationRules, courses] = await Promise.all([
    listEffectiveDirectSaleRules(db),
    listEffectiveGenerationRules(db),
    listAllCoursesForAdmin(db),
  ]);
  const titleByCourseId = new Map(courses.map((c) => [c.id, c.title]));

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Commission versée à l&apos;ambassadeur dont le lien a mené à un achat
          direct (section 11). Créer une règle ferme la précédente pour la même
          portée à partir de maintenant — aucune commission déjà versée
          n&apos;est recalculée.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle règle — vente directe</CardTitle>
            <CardDescription>
              La règle la plus spécifique s&apos;applique : formation exacte,
              puis catégorie, puis la règle par défaut.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewRuleForm
              courses={courses.map((c) => ({ id: c.id, title: c.title }))}
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {directSaleRules.length} règle(s) vente directe actuellement
            effective(s)
          </p>
          {directSaleRules.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune règle — aucun achat direct ne versera de commission tant
              qu&apos;aucune règle n&apos;existe.
            </p>
          ) : (
            directSaleRules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {describeDirectSaleRule(rule)}
                  </CardTitle>
                  <CardDescription>
                    {rule.courseId
                      ? (titleByCourseId.get(rule.courseId) ??
                        "Formation supprimée")
                      : rule.category
                        ? `Catégorie : ${rule.category}`
                        : "Règle par défaut (toutes les formations)"}
                    {rule.cap != null &&
                      ` · plafond ${rule.cap.toLocaleString("fr-FR")} F`}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Commission versée quand une génération (niveaux 2 à 5) est qualifiée —
          par défaut, l&apos;effectif complet suffit (comportement historique).
          Une règle ici peut resserrer la condition : volume minimum, ou
          effectif complet ET volume minimum ensemble (section 14/16/17).
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle règle — génération</CardTitle>
            <CardDescription>
              Une règle par (niveau, génération) — en créer une ferme la
              précédente pour ce même couple.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewGenerationRuleForm />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {generationRules.length} règle(s) génération actuellement
            effective(s) — les autres (niveau, génération) restent au barème
            historique (voir Paramètres).
          </p>
          {generationRules.map((rule) => {
            const { amount, conditions } = describeGenerationRule(rule);
            return (
              <Card key={rule.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Niveau {rule.levelCode} · Génération {rule.generation} —{" "}
                    {amount}
                  </CardTitle>
                  <CardDescription>
                    Condition : {conditions}
                    {rule.cap != null &&
                      ` · plafond ${rule.cap.toLocaleString("fr-FR")} F`}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
