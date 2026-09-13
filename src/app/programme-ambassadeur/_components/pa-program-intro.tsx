import { Link2, Megaphone, Share2, UserCheck, Users } from "lucide-react";
import { Reveal } from "@/app/_components/reveal";

const CAPACITIES = [
  { icon: Megaphone, text: "Recommander les formations qui t'ont aidé." },
  { icon: Link2, text: "Partager ton lien personnel." },
  {
    icon: UserCheck,
    text: "Accompagner des personnes vers les ressources Kinetix.",
  },
  { icon: Users, text: "Développer progressivement une communauté." },
  {
    icon: Share2,
    text: "Être rémunéré lorsqu'une recommandation aboutit à une vente.",
  },
];

export function PaProgramIntro() {
  return (
    <section id="programme" className="bg-muted/40 scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-primary text-center text-sm font-semibold tracking-wide uppercase">
            Et si tu pouvais aller plus loin ?
          </p>
          <h2 className="font-heading mt-3 text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Du membre qui apprend au membre qui contribue.
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-pretty">
            Si Kinetix t&apos;apporte de la valeur, tu peux devenir ambassadeur
            : recommander ce qui t&apos;a réellement aidé, et être rémunéré pour
            la valeur commerciale que tu génères.
          </p>
        </Reveal>

        <Reveal delayMs={100}>
          <ul className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            {CAPACITIES.map((item) => (
              <li
                key={item.text}
                className="border-border bg-card flex items-start gap-3 rounded-xl border p-4"
              >
                <item.icon className="text-primary mt-0.5 size-4.5 shrink-0" />
                <span className="text-sm leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delayMs={150}>
          <div className="border-primary/20 bg-primary/5 mx-auto mt-10 max-w-2xl rounded-2xl border p-6 text-center">
            <p className="font-heading text-lg font-semibold text-balance sm:text-xl">
              Tu n&apos;es pas payé simplement parce que quelqu&apos;un rejoint
              Kinetix.
            </p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Tu es rémunéré lorsqu&apos;une recommandation aboutit à une
              véritable vente.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
