"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// The ambassador's referral link, in full, ready to copy or send. Whoever
// opens it and then signs up finds this ambassador's pseudo already filled
// in as their sponsor (app/r/[code] sets the cookie the sign-up page reads).
export function ReferralLinkCard({
  url,
  validDays,
}: {
  url: string;
  validDays: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez ce lien :", url);
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Rejoins-moi sur Kinetix Africa : formations, mentorat et communauté. Inscris-toi avec mon lien : ${url}`,
  )}`;

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="text-primary size-4" />
        Mon lien de parrainage
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <code className="bg-muted min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-sm break-all select-all">
          {url}
        </code>
        <div className="flex gap-2">
          <Button type="button" onClick={copy} className="flex-1 sm:flex-none">
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Lien copié" : "Copier"}
          </Button>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:bg-muted inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium sm:flex-none"
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full bg-[#25D366]"
            />
            WhatsApp
          </a>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        La personne qui ouvre ce lien puis s&apos;inscrit trouve ton pseudo déjà
        renseigné comme parrain. Le lien reste actif {validDays} jours sur son
        appareil.
      </p>
    </div>
  );
}
