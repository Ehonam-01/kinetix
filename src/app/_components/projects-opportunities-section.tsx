import { FolderKanban, Target } from "lucide-react";
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
            "Présenter un projet, rechercher des compétences précises (développement, design, marketing) et trouver des collaborateurs.",
          image: {
            src: "/projects-photo.jpg",
            alt: "Membres Kinetix travaillant sur un projet",
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
            alt: "Une opportunité concrétisée via Kinetix",
            brief:
              "Photo évoquant une mission, un stage ou une collaboration réelle décrochée via Kinetix.",
          },
        },
      ]}
    />
  );
}
