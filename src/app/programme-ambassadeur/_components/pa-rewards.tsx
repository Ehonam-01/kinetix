import { Gift } from "lucide-react";
import { Reveal } from "@/app/_components/reveal";
import type { CompensationLevel } from "../data";

// The material rewards, shown big after the level-by-level section: the
// item and the level that earns it — never its value (explicit decision:
// members see the item, not its price). Straight from the admin's reward
// catalog (data.ts), so a reward changed there changes here.
export function PaRewards({ levels }: { levels: CompensationLevel[] }) {
  const withReward = levels.filter((l) => l.reward);
  if (withReward.length === 0) return null;

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-brand-accent text-sm font-semibold tracking-wide uppercase">
              Récompenses matérielles
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Les récompenses qui t&apos;attendent
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              En plus de tes commissions, chaque niveau supérieur validé avec
              ton équipe te rapporte une récompense bien réelle.
            </p>
          </div>
        </Reveal>

        <div
          className={
            withReward.length === 1
              ? "mx-auto mt-12 max-w-xl"
              : "mt-12 grid gap-6 sm:grid-cols-2"
          }
        >
          {withReward.map((level, i) => (
            <Reveal key={level.code} delayMs={100 + i * 80}>
              <article className="border-border bg-card group overflow-hidden rounded-3xl border shadow-sm">
                <div className="bg-muted relative aspect-[4/3] overflow-hidden">
                  {level.reward!.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
                    <img
                      src={level.reward!.imageUrl}
                      alt={level.reward!.name}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="text-brand-accent flex size-full items-center justify-center">
                      <Gift className="size-16" />
                    </div>
                  )}
                  <span className="bg-background/90 text-foreground absolute top-4 left-4 rounded-full px-3 py-1 text-sm font-semibold backdrop-blur">
                    Niveau {level.name}
                  </span>
                </div>
                <div className="space-y-1 p-6">
                  <h3 className="text-2xl font-semibold">
                    {level.reward!.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    À gagner en validant le niveau{" "}
                    <span className="text-foreground font-medium">
                      {level.name}
                    </span>{" "}
                    avec ton équipe.
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={300}>
          <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed">
            Récompenses en vigueur à ce jour, remises selon les règles du
            programme ambassadeur. Visuels non contractuels.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
