// The fixed taxonomy behind "Que veux-tu accomplir ?" (app/_components/goal-section.tsx)
// and a member's own profile (dashboard/settings, the community directory's
// filter) — one shared list so the two never drift apart. value is what's
// stored in profiles.goal; label is what's shown.
export const GOAL_OPTIONS = [
  { value: "emploi", label: "Trouver un emploi" },
  { value: "entreprendre", label: "Entreprendre" },
  { value: "ia", label: "Maîtriser l'IA" },
  { value: "competence", label: "Développer une compétence" },
  { value: "freelance", label: "Devenir freelance" },
  { value: "projet", label: "Développer mon projet" },
  { value: "mentor", label: "Trouver un mentor" },
  { value: "reseau", label: "Développer mon réseau" },
  { value: "incertain", label: "Je ne sais pas encore" },
] as const;

export type GoalValue = (typeof GOAL_OPTIONS)[number]["value"];

// The courses the public orientation page (app/orientation/[objectif])
// puts forward for each goal, by slug, best first. Editorial: change them
// freely; a slug that no longer matches a published course is skipped, and
// a goal left with none shows the whole catalogue.
export const GOAL_COURSE_SLUGS: Record<GoalValue, string[]> = {
  emploi: [
    "video-ia-masterclass-creez-des-videos-spectaculaires-avec-l-ia",
    "montage-video-pro-avec-capcut",
    "creation-d-images-et-d-affiches-avec-l-ia",
    "creer-une-page-de-vente",
  ],
  entreprendre: [
    "comment-lancer-une-entreprise-a-succes",
    "se-lancer-dans-l-e-commerce-en-afrique",
    "creation-de-boutique-et-vente-de-produits-digitaux",
    "creer-une-page-de-vente",
  ],
  ia: [
    "video-ia-masterclass-creez-des-videos-spectaculaires-avec-l-ia",
    "creation-d-images-et-d-affiches-avec-l-ia",
    "creez-une-application-web-avec-l-ia",
  ],
  competence: [
    "montage-video-pro-avec-capcut",
    "creation-d-images-et-d-affiches-avec-l-ia",
    "creer-une-page-de-vente",
    "creez-une-application-web-avec-l-ia",
  ],
  freelance: [
    "montage-video-pro-avec-capcut",
    "video-ia-masterclass-creez-des-videos-spectaculaires-avec-l-ia",
    "creation-d-images-et-d-affiches-avec-l-ia",
    "creer-une-page-de-vente",
  ],
  projet: [
    "comment-lancer-une-entreprise-a-succes",
    "creer-une-page-de-vente",
    "creez-une-application-web-avec-l-ia",
    "se-lancer-dans-l-e-commerce-en-afrique",
  ],
  mentor: ["comment-lancer-une-entreprise-a-succes", "transe-formation"],
  reseau: ["transe-formation", "comment-lancer-une-entreprise-a-succes"],
  incertain: [
    "transe-formation",
    "comment-lancer-une-entreprise-a-succes",
    "creation-d-images-et-d-affiches-avec-l-ia",
  ],
};

export function goalLabel(value: string | null): string | null {
  if (!value) return null;
  return GOAL_OPTIONS.find((g) => g.value === value)?.label ?? null;
}

export function isGoalValue(value: unknown): value is GoalValue {
  return GOAL_OPTIONS.some((g) => g.value === value);
}

// A visitor who picks a goal on the homepage before having an account
// (app/orientation/route.ts): remembered until they sign up or sign in.
export const GOAL_COOKIE_NAME = "kx_goal";
