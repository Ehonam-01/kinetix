import { ChevronDown } from "lucide-react";
import { Reveal } from "./reveal";

const FAQS = [
  {
    question: "Dois-je devenir ambassadeur pour suivre une formation ?",
    answer:
      "Non. Vous pouvez acheter et suivre nos formations simplement en tant que client. Le programme ambassadeur est entièrement optionnel.",
  },
  {
    question: "Comment accéder à une formation ?",
    answer:
      "Créez un compte, choisissez la formation qui vous intéresse, effectuez le paiement, puis accédez immédiatement au contenu depuis votre tableau de bord.",
  },
  {
    question: "Puis-je suivre plusieurs formations ?",
    answer:
      "Oui, vous pouvez acheter et suivre autant de formations que vous le souhaitez, chacune à votre propre rythme.",
  },
  {
    question: "Puis-je devenir ambassadeur plus tard ?",
    answer:
      "Oui. Vous pouvez commencer comme simple apprenant et rejoindre le programme ambassadeur ultérieurement si vous le souhaitez.",
  },
  {
    question: "Comment fonctionne le programme ambassadeur ?",
    answer:
      "Une fois inscrit au programme, vous recevez un lien personnel à partager. Lorsqu'une vente est réalisée grâce à ce lien, vous pouvez recevoir une commission selon les règles du programme.",
  },
  {
    question: "Comment sont calculées les commissions ?",
    answer:
      "Les commissions sont calculées selon les règles du programme ambassadeur, notamment les ventes éligibles et le Business Volume associé. Consultez les conditions du programme pour connaître les règles détaillées.",
  },
  {
    question: "Puis-je acheter une formation sans lien de parrainage ?",
    answer: "Oui.",
  },
  {
    question: "Puis-je devenir ambassadeur sans forcer mes proches à acheter ?",
    answer:
      "Le programme repose sur la recommandation des formations. Aucune personne n'est obligée de rejoindre le programme pour acheter une formation.",
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
