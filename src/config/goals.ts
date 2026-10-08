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
