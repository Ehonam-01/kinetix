import type { ReactNode } from "react";
import { isPlaceholder, LEGAL_LAST_UPDATED } from "@/config/legal";

// Shared building blocks for the three legal pages — plain, readable
// typography rather than marketing layout.

export function LegalDocument({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Dernière mise à jour : {LEGAL_LAST_UPDATED}
      </p>
      {intro && (
        <div className="text-muted-foreground mt-6 leading-relaxed">
          {intro}
        </div>
      )}
      <div className="mt-10 space-y-10">{children}</div>
    </article>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-foreground/85 space-y-3 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

// A value from config/legal.ts — highlighted while it's still a
// placeholder, so an unfilled field is obvious on the live page.
export function Field({ value }: { value: string }) {
  if (!isPlaceholder(value)) return <>{value}</>;
  return (
    <mark className="rounded bg-amber-200 px-1 text-amber-950 dark:bg-amber-400/30 dark:text-amber-100">
      {value}
    </mark>
  );
}

export function Definition({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <li>
      <strong>{term}</strong> : {children}
    </li>
  );
}
