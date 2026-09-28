// Publisher identity shown on the legal pages (mentions légales, conditions
// d'utilisation, confidentialité). Every value still in [BRACKETS] is a
// placeholder to fill in — the legal pages render them highlighted so a
// missing one can't go unnoticed in production.
export const LEGAL_ENTITY = {
  companyName: "[RAISON SOCIALE]",
  legalForm: "[FORME JURIDIQUE — ex. SARL]",
  shareCapital: "[CAPITAL SOCIAL] F CFA",
  rccm: "[NUMÉRO RCCM]",
  taxId: "[NIF]",
  address: "[ADRESSE DU SIÈGE], Lomé, Togo",
  phone: "[TÉLÉPHONE]",
  email: "contact@kinetix-africa.com",
  publicationDirector: "[NOM DU DIRECTEUR DE LA PUBLICATION]",
  // Courts named in the terms of use for disputes.
  jurisdiction: "Lomé",
} as const;

export const LEGAL_LAST_UPDATED = "28 septembre 2026";

export function isPlaceholder(value: string): boolean {
  return value.includes("[");
}
