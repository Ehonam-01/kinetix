import Link from "next/link";
import { Link2, Megaphone, ShoppingBag, UserPlus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { GridBackdrop } from "./grid-backdrop";
import { Reveal } from "./reveal";

const STEPS = [
  { icon: UserPlus, label: "Devenez ambassadeur" },
  { icon: Link2, label: "Partagez vos liens" },
  { icon: Megaphone, label: "Recommandez les formations" },
  { icon: ShoppingBag, label: "Générez des souscriptions" },
  { icon: Wallet, label: "Recevez vos commissions" },
];

// Secondary section, on purpose: the platform sells formations first, this
// is presented as an optional extra — never framed as recruitment (section
// 33 of the brief is explicit about the language to avoid here).
export function AmbassadorSection() {
  return (
    <section
      id="ambassadeurs"
      className="bg-muted/40 relative scroll-mt-16 overflow-hidden py-16 sm:py-24"
    >
      <GridBackdrop />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Envie d&apos;aller plus loin avec Kinetix ?
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Vous aimez une formation et souhaitez la recommander ? Notre
              programme ambassadeur vous permet de partager les formations de la
              plateforme et de recevoir des commissions sur les souscriptions
              éligibles.
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-3">
            {STEPS.map((step, i) => (
              <div
                key={step.label}
                className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border p-4 text-center"
              >
                <span className="text-muted-foreground/50 text-xs font-semibold">
                  {i + 1}
                </span>
                <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                  <step.icon className="size-4.5" />
                </div>
                <p className="text-xs leading-snug font-medium">{step.label}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={150}>
          <p className="text-muted-foreground mx-auto mt-8 max-w-xl text-center text-sm leading-relaxed">
            Les ambassadeurs disposent également d&apos;un système de
            progression basé notamment sur le volume commercial généré.
          </p>
        </Reveal>

        <Reveal delayMs={200}>
          <div className="mt-8 text-center">
            <Link
              href="/programme-ambassadeur"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-auto min-h-12 w-full px-6 py-3 text-base whitespace-normal sm:w-auto sm:whitespace-nowrap",
              )}
            >
              Découvrir le programme ambassadeur
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
