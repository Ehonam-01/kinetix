// Support tickets (dashboard/support, admin/support): the categories a
// member picks from, and how each status reads.
export const SUPPORT_CATEGORIES = [
  { value: "formations", label: "Formations et cours" },
  { value: "abonnement", label: "Abonnement et paiement" },
  { value: "ambassadeur", label: "Programme ambassadeur et réseau" },
  { value: "retraits", label: "Retraits et commissions" },
  { value: "compte", label: "Mon compte" },
  { value: "technique", label: "Problème technique" },
  { value: "autre", label: "Autre" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];

export function supportCategoryLabel(value: string) {
  return SUPPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

// OPEN: waiting for the team. ANSWERED: the team replied, waiting for the
// member. CLOSED: done — a new message from the member reopens it.
export const SUPPORT_STATUS_LABEL = {
  OPEN: "En attente de l'équipe",
  ANSWERED: "Répondu",
  CLOSED: "Fermé",
} as const;

// A member can't have more than this many tickets open at once.
export const MAX_OPEN_TICKETS = 3;
