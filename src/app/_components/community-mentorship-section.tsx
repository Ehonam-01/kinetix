import { Handshake, Users2 } from "lucide-react";
import { ComingSoonSection } from "./coming-soon-section";

export function CommunityMentorshipSection() {
  return (
    <ComingSoonSection
      id="communaute"
      eyebrow="Communauté & mentorat"
      title="Tu n'as pas à avancer seul."
      description="Rencontre d'autres jeunes ambitieux, échange, trouve un mentor qui a déjà fait le chemin — Kinetix est aussi un réseau, pas seulement des formations."
      cards={[
        {
          icon: Users2,
          title: "Communauté",
          description:
            "L'annuaire des membres est disponible : découvre qui apprend, quels objectifs ils poursuivent et quelles compétences ils développent.",
          href: "/dashboard/community",
          image: {
            src: "/community-photo.png",
            alt: "Membres de la communauté Kinetix qui échangent",
            brief:
              "Photo ou capture : des membres réels qui discutent, collaborent ou se rencontrent.",
          },
        },
        {
          icon: Handshake,
          title: "Mentorat",
          description:
            "Être mis en relation avec des personnes expérimentées dans ton domaine, pour ne plus tout devoir comprendre seul.",
          href: "/dashboard/mentors",
          image: {
            src: "/mentorship-photo.jpg",
            alt: "Un mentor Kinetix accompagnant un jeune",
            brief:
              "Portrait ou photo d'un vrai mentor avec un membre — pas de stock photo générique.",
          },
        },
      ]}
    />
  );
}
