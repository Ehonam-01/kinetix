"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Share a formation on social networks. Each network opens its own share
// page in a new tab — no third-party script on our pages, nothing
// tracked. The preview (image, title, description) comes from the public
// course page's Open Graph tags (app/formations/[slug]/page.tsx).
//
// On phones, "Partager" opens the system share sheet (every installed
// app), when the browser offers it.
const NETWORKS: {
  name: string;
  color: string;
  href: (url: string, text: string) => string;
}[] = [
  {
    name: "WhatsApp",
    color: "#25D366",
    href: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    name: "Facebook",
    color: "#1877F2",
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "X",
    color: "#000000",
    href: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: "LinkedIn",
    color: "#0A66C2",
    href: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Telegram",
    color: "#26A5E4",
    href: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
];

const noSubscription = () => () => {};

const PILL =
  "border-border bg-background hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors";

export function ShareCourse({
  url,
  courseTitle,
  hint,
  className,
}: {
  url: string;
  courseTitle: string;
  hint?: string;
  className?: string;
}) {
  const text = `Découvre la formation « ${courseTitle} » sur Kinetix Africa`;
  const [copied, setCopied] = useState(false);
  // Only known in the browser: false on the server, so both renders match.
  const canShare = useSyncExternalStore(
    noSubscription,
    () => "share" in navigator,
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez ce lien :", url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: courseTitle, text, url });
    } catch {
      // Closed by the user: nothing to do.
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Share2 className="size-4" />
        Partager cette formation
      </p>
      <div className="flex flex-wrap gap-2">
        {canShare && (
          <button type="button" onClick={nativeShare} className={PILL}>
            <Share2 className="size-3.5" />
            Partager
          </button>
        )}
        {NETWORKS.map((network) => (
          <a
            key={network.name}
            href={network.href(url, text)}
            target="_blank"
            rel="noopener noreferrer"
            className={PILL}
          >
            <span
              aria-hidden="true"
              className="ring-border size-2.5 rounded-full ring-1"
              style={{ backgroundColor: network.color }}
            />
            {network.name}
          </a>
        ))}
        <button type="button" onClick={copy} className={PILL}>
          {copied ? (
            <Check className="size-3.5 text-emerald-600" />
          ) : (
            <Link2 className="size-3.5" />
          )}
          {copied ? "Lien copié" : "Copier le lien"}
        </button>
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
