import Link from "next/link";
import { GraduationCap, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";

export function LearnerAmbassadorSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Vous voulez apprendre ? Commencez simplement.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Vous pouvez utiliser la plateforme uniquement pour vous former.
              Aucun besoin de devenir ambassadeur pour acheter ou suivre nos
              formations.
            </p>
          </div>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          <Reveal>
            <div className="border-border bg-card flex h-full flex-col rounded-2xl border p-8">
              <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                <GraduationCap className="size-5" />
              </div>
              <h3 className="font-heading mt-4 text-lg font-semibold">
                Je veux apprendre
              </h3>
              <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">
                Accédez aux formations, apprenez à votre rythme et développez
                vos compétences.
              </p>
              <a
                href="#formations"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "mt-6 w-full",
                )}
              >
                Découvrir les formations
              </a>
            </div>
          </Reveal>

          <Reveal delayMs={100}>
            <div className="border-border bg-card flex h-full flex-col rounded-2xl border p-8">
              <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                <Share2 className="size-5" />
              </div>
              <h3 className="font-heading mt-4 text-lg font-semibold">
                Je veux aussi recommander
              </h3>
              <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">
                Si vous souhaitez aller plus loin, vous pouvez devenir
                ambassadeur et recommander les formations à votre entourage et à
                votre audience.
              </p>
              <Link
                href="/programme-ambassadeur"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "mt-6 w-full",
                )}
              >
                Découvrir le programme ambassadeur
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
