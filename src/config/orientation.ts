// The orientation questionnaire's fixed choices (dashboard/mentors/
// orientation) — value is stored, label is shown to the member and the admin.
export const SITUATION_OPTIONS = [
  { value: "etudiant", label: "Étudiant(e)" },
  { value: "recherche_emploi", label: "En recherche d'emploi" },
  { value: "salarie", label: "Salarié(e)" },
  { value: "entrepreneur", label: "Entrepreneur / indépendant" },
  { value: "autre", label: "Autre" },
] as const;

export const LEVEL_OPTIONS = [
  { value: "debutant", label: "Je débute complètement" },
  { value: "intermediaire", label: "J'ai quelques bases" },
  { value: "avance", label: "J'ai déjà de l'expérience" },
] as const;

export const WEEKLY_TIME_OPTIONS = [
  { value: "moins_2h", label: "Moins de 2 h par semaine" },
  { value: "2_5h", label: "2 à 5 h par semaine" },
  { value: "5_10h", label: "5 à 10 h par semaine" },
  { value: "plus_10h", label: "Plus de 10 h par semaine" },
] as const;

type Option = { value: string; label: string };

export function optionLabel(options: readonly Option[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}
