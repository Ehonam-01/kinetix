"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "youtube", label: "YouTube" },
  { value: "google", label: "Google" },
];

const PAGES = [
  { value: "/", label: "Page d'accueil" },
  { value: "/businessplan", label: "Business Plan (ambassadeurs)" },
  { value: "/formations", label: "Catalogue des formations" },
  { value: "/register", label: "Inscription" },
];

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3";

// A link to put in an ad or a post: the page plus utm_* parameters, so
// visits, sign-ups and payments it brings show up under its own name in
// the table above.
const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function LinkBuilder({ siteUrl }: { siteUrl: string }) {
  const [source, setSource] = useState("facebook");
  const [page, setPage] = useState("/");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  const campaignSlug = slug(campaign);
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: source === "whatsapp" ? "message" : "paid_social",
    ...(campaignSlug ? { utm_campaign: campaignSlug } : {}),
    ...(slug(content) ? { utm_content: slug(content) } : {}),
  });
  const url = `${siteUrl}${page}?${params.toString()}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: the link stays selectable below.
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lb-source">Où sera publié le lien</Label>
          <select
            id="lb-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={SELECT_CLASS}
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lb-page">Page de destination</Label>
          <select
            id="lb-page"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className={SELECT_CLASS}
          >
            {PAGES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lb-campaign">Nom de la campagne</Label>
          <Input
            id="lb-campaign"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="Ex. Lancement octobre"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lb-content">
            Variante de la pub{" "}
            <span className="text-muted-foreground font-normal">
              (facultatif)
            </span>
          </Label>
          <Input
            id="lb-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ex. video-temoignage"
          />
        </div>
      </div>
      <div className="bg-muted/50 space-y-2 rounded-xl border p-3">
        <p className="text-sm break-all select-all">{url}</p>
        <Button size="sm" onClick={copy} disabled={!campaignSlug}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copié" : "Copier le lien"}
        </Button>
        {!campaignSlug && (
          <p className="text-muted-foreground text-xs">
            Donnez un nom à la campagne pour la retrouver dans le tableau.
          </p>
        )}
      </div>
    </div>
  );
}
