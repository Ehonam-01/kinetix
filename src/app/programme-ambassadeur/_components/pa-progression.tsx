import { Gift, Users } from "lucide-react";
import { Reveal } from "@/app/_components/reveal";
import type { CompensationLevel, GenerationPay } from "../data";

// Members a level counts: its generations of 2, 4 then 8 (levels.config).
const MEMBERS_PER_LEVEL = 14;

function formatF(amount: number) {
  return `${amount.toLocaleString("fr-FR")} F`;
}

function GenerationLine({ pay }: { pay: GenerationPay }) {
  if (pay.kind === "percent") {
    return (
      <>
        <p className="text-primary text-2xl font-bold">
          {pay.value.toLocaleString("fr-FR")}&nbsp;%
        </p>
        <p className="text-muted-foreground text-xs">
          de l&apos;abonnement, par membre qualifié de ton équipe
        </p>
      </>
    );
  }
  const same = pay.min === pay.max;
  return (
    <>
      <p className="text-primary text-2xl font-bold whitespace-nowrap">
        {same ? formatF(pay.min) : `${formatF(pay.min)} à ${formatF(pay.max)}`}
      </p>
      <p className="text-muted-foreground text-xs">
        par membre qualifié de ton équipe
      </p>
      {same && (
        <p className="text-muted-foreground mt-1 text-xs">
          Jusqu&apos;à{" "}
          <span className="text-foreground font-medium">
            {formatF(pay.min * MEMBERS_PER_LEVEL)}
          </span>{" "}
          en validant le niveau
        </p>
      )}
    </>
  );
}

// The team side of the programme: build a team of ambassadors, and earn
// generation commissions and material rewards as it progresses, level by
// level. Every figure comes from the live rules (data.ts); rewards show
// their name and picture, never their value.
export function PaProgression({ levels }: { levels: CompensationLevel[] }) {
  return (
    <section className="bg-muted/40 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Développe ton équipe, progresse de niveau en niveau.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              En plus de tes commissions directes, construis ton équipe
              d&apos;ambassadeurs. Quand ton équipe s&apos;abonne et progresse,
              tu touches des commissions de génération sur plusieurs niveaux et
              tu débloques des récompenses matérielles.
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={80}>
          <div className="text-muted-foreground mx-auto mt-8 flex max-w-2xl items-start gap-3 text-sm">
            <Users className="text-primary mt-0.5 size-5 shrink-0" />
            <p>
              {levels[1]
                ? `À partir du niveau ${levels[1].name}, chaque niveau se valide`
                : "Chaque niveau se valide"}{" "}
              sur trois générations de ton équipe :{" "}
              <span className="text-foreground font-medium">
                2, puis 4, puis 8 membres
              </span>{" "}
              ayant eux-mêmes atteint ce niveau. Chaque génération complète te
              rapporte sa commission.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {levels.map((level, i) => (
            <Reveal key={level.code} delayMs={120 + i * 60}>
              <div className="border-border bg-card flex h-full flex-col gap-4 rounded-2xl border p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border px-3 py-1 text-sm font-semibold">
                    {level.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Niveau {level.code}
                  </span>
                </div>

                <div className="flex-1">
                  {level.generation ? (
                    <GenerationLine pay={level.generation} />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {i === 0
                        ? "Le point de départ : tes premiers parrainages lancent ton équipe et débloquent le niveau suivant."
                        : "Débloque le niveau suivant."}
                    </p>
                  )}
                </div>

                {level.reward && (
                  <div className="border-border flex items-center gap-3 border-t pt-4">
                    {level.reward.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
                      <img
                        src={level.reward.imageUrl}
                        alt=""
                        className="size-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="bg-brand-accent/10 text-brand-accent flex size-12 shrink-0 items-center justify-center rounded-lg">
                        <Gift className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        Récompense
                      </p>
                      <p className="text-sm font-semibold wrap-anywhere">
                        {level.reward.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={300}>
          <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed">
            Les commissions de génération reposent sur les abonnements réels de
            ton équipe : une simple inscription ne rapporte rien. Montants en
            vigueur à ce jour, donnés à titre indicatif : ce n&apos;est pas une
            promesse de gains, tout dépend de l&apos;activité réelle de ton
            équipe.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
