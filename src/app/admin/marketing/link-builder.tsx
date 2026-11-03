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
  { value: "/atelier-video-ia", label: "Masterclass vidéo IA" },
];

// The choice that opens a field to paste the link of any page of the site.
const CUSTOM_PAGE = "custom";

const sameSite = (a: string, b: string) =>
  a.replace(/^www\./, "") === b.replace(/^www\./, "");

// The page to send people to: one from the list, or a pasted link (a full
// address or a path) that has to stay on this site, the only place the
// utm_* are read. Its own parameters and #anchor are kept; any utm_* it
// already carries gives way to the ones built here.
function targetUrl(
  siteUrl: string,
  page: string,
  pasted: string,
): { url: URL } | { error: string } {
  const site = new URL(siteUrl);
  if (page !== CUSTOM_PAGE) return { url: new URL(page, site) };
  const input = pasted.trim();
  if (!input) return { error: "Collez le lien de la page." };
  // "kinetix-africa.com/..." pasted without its https://: an address, not
  // a path of this site.
  const withScheme =
    input.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(input)
      ? input
      : `https://${input}`;
  let url: URL;
  try {
    url = new URL(withScheme, site);
  } catch {
    return { error: "Ce lien n'est pas valide." };
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !sameSite(url.hostname, site.hostname)
  ) {
    return {
      error: `Le lien doit mener à une page de ${site.hostname.replace(/^www\./, "")} : c'est là que les visites sont comptées.`,
    };
  }
  const target = new URL(url.pathname + url.search + url.hash, site);
  for (const key of [...target.searchParams.keys()]) {
    if (key.startsWith("utm_")) target.searchParams.delete(key);
  }
  return { url: target };
}

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
  const [pasted, setPasted] = useState("");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  const campaignSlug = slug(campaign);
  const params = {
    utm_source: source,
    utm_medium: source === "whatsapp" ? "message" : "paid_social",
    ...(campaignSlug ? { utm_campaign: campaignSlug } : {}),
    ...(slug(content) ? { utm_content: slug(content) } : {}),
  };
  const target = targetUrl(siteUrl, page, pasted);
  let url = "";
  if ("url" in target) {
    for (const [key, value] of Object.entries(params)) {
      target.url.searchParams.set(key, value);
    }
    url = target.url.toString();
  }

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
            <option value={CUSTOM_PAGE}>Autre page : coller son lien</option>
          </select>
        </div>
        {page === CUSTOM_PAGE && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="lb-pasted">Lien de la page</Label>
            <Input
              id="lb-pasted"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={`${siteUrl}/atelier-video-ia`}
              inputMode="url"
              autoFocus
            />
          </div>
        )}
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
        {"error" in target ? (
          <p className="text-destructive text-sm">{target.error}</p>
        ) : (
          <p className="text-sm break-all select-all">{url}</p>
        )}
        <Button size="sm" onClick={copy} disabled={!campaignSlug || !url}>
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
