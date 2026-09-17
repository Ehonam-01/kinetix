import { Handshake, Users2 } from "lucide-react";
import { ComingSoonSection } from "./coming-soon-section";

export function CommunityMentorshipSection() {
  return (
    <ComingSoonSection
      id="communaute"
      eyebrow="Communauté & mentorat"
      title="Les bonnes opportunités commencent souvent par les bonnes rencontres."
      description="Rencontrer d'autres jeunes ambitieux, partager son expérience, trouver un mentor pour ne pas avancer seul — c'est la prochaine brique de Kinetix."
      cards={[
        {
          icon: Users2,
          title: "Communauté",
          description:
            "Échanger avec d'autres membres, demander conseil, trouver des collaborateurs et partager ses projets.",
        },
        {
          icon: Handshake,
          title: "Mentorat",
          description:
            "Être mis en relation avec des personnes expérimentées dans ton domaine, pour ne plus tout devoir comprendre seul.",
        },
      ]}
    />
  );
}
