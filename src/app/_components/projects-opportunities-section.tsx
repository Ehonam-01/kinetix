import { ArrowUpRight, Briefcase, FolderKanban, Target } from "lucide-react";
import { ComingSoonSection } from "./coming-soon-section";

export function ProjectsOpportunitiesSection() {
  return (
    <ComingSoonSection
      id="projets"
      eyebrow="Projets & opportunités"
      title="Une idée peut devenir un projet. Un projet peut devenir une opportunité."
      description="Les compétences deviennent utiles lorsqu'elles ouvrent des portes. Kinetix ne s'arrête pas à l'apprentissage — l'objectif est d'aider à passer à l'action."
      muted
      cards={[
        {
          icon: FolderKanban,
          title: "Projets",
          description:
            "Des ateliers pratiques de vibe coding pour les membres : de l'idée à ton premier SaaS avec l'IA, accompagné pas à pas. Présente ton projet, trouve les compétences qui te manquent et des collaborateurs.",
          image: {
            src: "/projects-photo.jpg",
            alt: "Atelier pratique de vibe coding Kinetix Africa : des membres créent leur SaaS avec l'IA",
            brief:
              "Photo ou capture d'écran : un vrai projet en cours, des membres qui construisent ensemble.",
          },
        },
        {
          icon: Target,
          title: "Opportunités",
          description:
            "Missions, freelancing, stages et collaborations proposés au sein de la communauté Kinetix.",
          image: {
            src: "/opportunities-photo.jpg",
            alt: "Edossimé, la marketplace freelance panafricaine où proposer ses compétences",
            brief:
              "Photo évoquant une mission, un stage ou une collaboration réelle décrochée via Kinetix.",
          },
          // What's learned on Kinetix can be sold as a freelancer on
          // Edossimé, the pan-African freelance marketplace.
          extra: (
            <div className="border-brand-accent/30 bg-brand-accent/10 mt-5 w-full rounded-2xl border p-4 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Briefcase className="text-brand-accent size-4 shrink-0" />
                Vends tes compétences en freelance
              </p>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Les compétences acquises sur Kinetix, tu peux les proposer à des
                clients comme freelance sur Edossimé, la marketplace freelance
                panafricaine.
              </p>
              <a
                href="https://www.edossime.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-accent mt-2 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                Découvrir Edossimé
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          ),
        },
      ]}
    />
  );
}
