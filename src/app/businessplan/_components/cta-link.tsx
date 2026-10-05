"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// The pseudo the sign-up form will pre-fill, when the ambassador shared
// this page as /businessplan?parrain=<pseudo>. Same shape the referral
// links accept (app/r/[code]), anything else is ignored.
const PSEUDO = /^[a-z0-9_]{1,64}$/;

function useSignupHref(siteUrl: string) {
  const params = useSearchParams();
  const sponsor = (params.get("parrain") ?? params.get("sponsor") ?? "")
    .trim()
    .toLowerCase();
  return PSEUDO.test(sponsor)
    ? `${siteUrl}/register?sponsor=${encodeURIComponent(sponsor)}`
    : `${siteUrl}/register`;
}

function Inner({
  siteUrl,
  className,
  children,
}: {
  siteUrl: string;
  className?: string;
  children: ReactNode;
}) {
  const href = useSignupHref(siteUrl);
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export const CTA_CLASS =
  "group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f5a524] px-7 text-base font-bold tracking-wide text-[#14100a] uppercase shadow-[0_10px_30px_-10px_rgba(245,165,36,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#ffb93d] hover:shadow-[0_14px_36px_-10px_rgba(245,165,36,0.85)] focus-visible:ring-2 focus-visible:ring-[#f5a524] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b17] focus-visible:outline-none";

// Every call to action on the page goes to the same sign-up page, carrying
// the sponsor when the link had one.
export function CtaLink({
  siteUrl,
  className,
  children = "Je deviens ambassadeur",
}: {
  siteUrl: string;
  className?: string;
  children?: ReactNode;
}) {
  const fallback = (
    <a href={`${siteUrl}/register`} className={cn(CTA_CLASS, className)}>
      {children}
    </a>
  );
  return (
    <Suspense fallback={fallback}>
      <Inner siteUrl={siteUrl} className={cn(CTA_CLASS, className)}>
        {children}
      </Inner>
    </Suspense>
  );
}

// Phones only: the offer stays one thumb away while reading.
export function StickyMobileCta({
  siteUrl,
  price,
}: {
  siteUrl: string;
  price: number;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#070b17]/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur md:hidden">
      <CtaLink siteUrl={siteUrl} className="w-full text-sm">
        Rejoindre — {price.toLocaleString("fr-FR")} FCFA
      </CtaLink>
    </div>
  );
}
