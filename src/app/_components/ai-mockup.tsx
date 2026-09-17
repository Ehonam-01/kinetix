import { Sparkles, Wand2 } from "lucide-react";

// A hand-built illustration, same spirit and construction as
// product-mockup.tsx (not a screenshot, evocative of a chat with an AI
// assistant) — deliberately not a humanoid-robot cliché, just a plausible
// product surface: a prompt, a structured answer, a couple of capability
// chips.
export function AiMockup() {
  return (
    <div className="border-border bg-card mx-auto max-w-md rounded-2xl border p-5 shadow-2xl lg:max-w-none">
      <div className="flex items-center gap-2 pb-4">
        <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
          <Sparkles className="size-3.5" />
        </span>
        <span className="text-sm font-medium">Assistant IA</span>
      </div>

      <div className="bg-muted ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
        Aide-moi à structurer le plan de lancement de mon projet.
      </div>

      <div className="border-border bg-background mt-3 w-fit max-w-[92%] rounded-2xl rounded-tl-sm border px-4 py-3 text-sm leading-relaxed">
        <p className="flex items-center gap-1.5 font-medium">
          <Wand2 className="text-primary size-3.5" />
          Voici un point de départ
        </p>
        <ol className="text-muted-foreground mt-1.5 list-decimal space-y-1 pl-4">
          <li>Définir l&apos;audience et le problème résolu</li>
          <li>Prioriser les 3 premières actions</li>
          <li>Fixer un jalon à 30 jours</li>
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Productivité", "Création", "Automatisation"].map((chip) => (
          <span
            key={chip}
            className="border-border text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-medium"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
