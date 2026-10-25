import Link from "next/link";
import { Trophy } from "lucide-react";
import { getSiteEnv } from "@/config/env.site";
import { requireAdmin } from "@/services/auth/current-user";
import {
  getCampaignReport,
  getMetaPixelId,
  type CampaignRow,
} from "@/services/marketing/campaign-tracking";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LinkBuilder } from "./link-builder";
import { PixelForm } from "./pixel-form";

const PERIODS = [7, 30, 90] as const;

const fmt = (n: number) => n.toLocaleString("fr-FR");
const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)} %` : "—";

const SOURCE_LABEL: Record<string, string> = {
  facebook: "Facebook",
  fb: "Facebook",
  instagram: "Instagram",
  ig: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  google: "Google",
  direct: "Direct, parrainage ou non suivi",
};

function sourceLabel(source: string) {
  if (source.startsWith("site:")) return `Lien depuis ${source.slice(5)}`;
  return SOURCE_LABEL[source] ?? source;
}

// Admin → Marketing: the Meta pixel, and which campaigns bring members
// who actually pay (services/marketing/campaign-tracking.ts).
export default async function AdminMarketingPage(
  props: PageProps<"/admin/marketing">,
) {
  await requireAdmin();
  const { jours } = await props.searchParams;
  const days =
    PERIODS.find((p) => String(p) === jours) ??
    (30 as (typeof PERIODS)[number]);
  const [rows, pixelId] = await Promise.all([
    getCampaignReport(days),
    getMetaPixelId(),
  ]);

  const totals = rows.reduce(
    (t, r) => ({
      visitors: t.visitors + r.visitors,
      signups: t.signups + r.signups,
      paid: t.paid + r.paid,
      revenue: t.revenue + r.revenue,
    }),
    { visitors: 0, signups: 0, paid: 0, revenue: 0 },
  );
  const tracked = rows.filter((r) => r.source !== "direct");
  const best: CampaignRow | undefined = tracked.find((r) => r.paid > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Quelles campagnes amènent des membres qui paient.
        </p>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/marketing?jours=${p}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                p === days
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {p} jours
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Visiteurs suivis", value: fmt(totals.visitors) },
          { label: "Inscriptions", value: fmt(totals.signups) },
          {
            label: "Abonnés payés",
            value: fmt(totals.paid),
            hint: pct(totals.paid, totals.signups) + " des inscrits",
          },
          { label: "Revenus des abonnés", value: `${fmt(totals.revenue)} F` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border p-4">
            <p className="text-muted-foreground text-xs">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
            {stat.hint && (
              <p className="text-muted-foreground text-xs">{stat.hint}</p>
            )}
          </div>
        ))}
      </div>

      {best && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <Trophy className="size-5 shrink-0 text-amber-600" />
          <p>
            <strong>Meilleure campagne sur {days} jours :</strong>{" "}
            {sourceLabel(best.source)}
            {best.campaign ? ` · ${best.campaign}` : ""} — {fmt(best.paid)}{" "}
            abonné{best.paid > 1 ? "s" : ""} payé{best.paid > 1 ? "s" : ""},{" "}
            {fmt(best.revenue)} F.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Campagnes</CardTitle>
          <CardDescription>
            Une inscription est attribuée à la première campagne par laquelle le
            visiteur est arrivé (30 jours). Classées par abonnés payés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune visite ni inscription sur cette période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Campagne</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Visiteurs
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Inscriptions
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Visiteur → inscrit
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Abonnés payés
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Inscrit → abonné
                    </th>
                    <th className="py-2 text-right font-medium">Revenus</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.source}:${r.campaign ?? ""}`}
                      className={cn(
                        "border-b last:border-0",
                        r === best && "bg-amber-500/5",
                      )}
                    >
                      <td className="py-2.5 pr-3 font-medium">
                        {sourceLabel(r.source)}
                      </td>
                      <td className="text-muted-foreground py-2.5 pr-3">
                        {r.campaign ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {r.source === "direct" ? "—" : fmt(r.visitors)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {fmt(r.signups)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {r.source === "direct"
                          ? "—"
                          : pct(r.signups, r.visitors)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                        {fmt(r.paid)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {pct(r.paid, r.signups)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {fmt(r.revenue)} F
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Créer un lien de campagne</CardTitle>
          <CardDescription>
            Utilisez ce lien dans chaque publicité ou publication : ses visites,
            inscriptions et paiements apparaîtront sous son nom dans le tableau.
            Un lien différent par campagne (et par variante) pour les comparer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinkBuilder siteUrl={getSiteEnv().SITE_URL} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pixel Meta (Facebook)</CardTitle>
          <CardDescription>
            L&apos;identifiant du pixel, dans le Gestionnaire d&apos;événements
            de Meta. Le pixel n&apos;est chargé que chez les visiteurs qui
            l&apos;acceptent (bandeau de consentement). Événements envoyés :
            PageView (chaque page), CompleteRegistration (inscription terminée),
            Purchase (abonnement payé, en F CFA).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PixelForm current={pixelId} />
        </CardContent>
      </Card>
    </div>
  );
}
