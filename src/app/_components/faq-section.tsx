import { ChevronDown } from "lucide-react";
import { Reveal } from "./reveal";

const FAQS = [
  {
    question:
      "Pourquoi se former maintenant, alors que l'IA change déjà tout ?",
    answer:
      "Parce que les métiers et les compétences recherchées évoluent plus vite que les formations classiques. Plus tu attends, plus l'écart se creuse avec celles et ceux qui se préparent déjà — Kinetix Africa existe pour que tu ne sois jamais dans le deuxième groupe.",
  },
  {
    question: "Dois-je devenir ambassadeur pour suivre une formation ?",
    answer:
      "Non. Tu peux accéder à nos formations et les suivre simplement en tant qu'apprenant. Le programme ambassadeur est entièrement optionnel.",
  },
  {
    question: "Comment accéder aux formations ?",
    answer:
      "Crée un compte et souscris à l'abonnement annuel : tu accèdes immédiatement à tout le catalogue depuis ton tableau de bord, sans payer chaque formation séparément. Tu peux aussi le payer en 3 fois.",
  },
  {
    question: "Suis-je engagé sur la durée ?",
    answer:
      "Non, l'abonnement est sans engagement. Il dure un an et n'est jamais renouvelé automatiquement : avant l'échéance, tu reçois un rappel, puis tu choisis librement de renouveler ou non.",
  },
  {
    question: "Puis-je suivre plusieurs formations ?",
    answer:
      "Oui — l'abonnement donne accès à tout le catalogue. Suis autant de formations que tu le souhaites, chacune à ton rythme.",
  },
  {
    question: "Puis-je devenir ambassadeur plus tard ?",
    answer:
      "Oui. Tu peux commencer comme simple apprenant et rejoindre le programme ambassadeur plus tard, si tu le souhaites.",
  },
  {
    question: "Comment fonctionne le programme ambassadeur ?",
    answer:
      "Une fois inscrit au programme, tu reçois un lien personnel à partager. Lorsqu'une personne souscrit à l'abonnement grâce à ce lien, tu peux recevoir une commission selon les règles du programme.",
  },
  {
    question: "Comment sont calculées les commissions ?",
    answer:
      "Les commissions sont calculées selon les règles du programme ambassadeur, notamment les souscriptions éligibles et le volume généré. Consulte les conditions du programme pour connaître les règles détaillées.",
  },
  {
    question: "Puis-je m'abonner sans lien de parrainage ?",
    answer: "Oui.",
  },
  {
    question:
      "Puis-je devenir ambassadeur sans forcer mes proches à s'abonner ?",
    answer:
      "Le programme repose sur la recommandation des formations. Aucune personne n'est obligée de rejoindre le programme pour s'abonner.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Questions fréquentes
          </h2>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="border-border divide-border mt-10 divide-y rounded-2xl border">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
