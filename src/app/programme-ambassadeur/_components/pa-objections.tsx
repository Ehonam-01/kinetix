import { ChevronDown } from "lucide-react";
import { Reveal } from "@/app/_components/reveal";

const OBJECTIONS = [
  {
    question: "Est-ce un MLM ?",
    answer:
      "Kinetix possède une structure de recommandation et de commissions. Mais la rémunération est liée aux souscriptions réelles à l'abonnement, jamais au simple fait qu'une personne rejoigne le programme.",
  },
  {
    question: "Dois-je recruter pour gagner ?",
    answer:
      "Non. Un ambassadeur peut générer une commission directe simplement en apportant une souscription, sans jamais avoir à recruter qui que ce soit.",
  },
  {
    question: "Combien puis-je gagner ?",
    answer:
      "Il n'existe aucun montant garanti. Tes gains dépendent des souscriptions réellement apportées, de ton activité et des règles en vigueur du programme.",
  },
  {
    question: "Est-ce garanti ?",
    answer:
      "Non. Les résultats ne sont jamais garantis. Ils dépendent de ton engagement et de ton activité réelle.",
  },
];

export function PaObjections() {
  return (
    <section id="faq" className="scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Questions franches, réponses franches
          </h2>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="border-border divide-border mt-10 divide-y rounded-2xl border">
            {OBJECTIONS.map((item) => (
              <details key={item.question} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
