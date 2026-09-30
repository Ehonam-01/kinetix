// Publisher identity shown on the legal pages (mentions légales, conditions
// d'utilisation, confidentialité). Every value still in [BRACKETS] is a
// placeholder to fill in — the legal pages render them highlighted so a
// missing one can't go unnoticed in production.
export const LEGAL_ENTITY = {
  companyName: "EXCELLENCIA GROUP LTD",
  // An English private limited company (company numbers without an SC/NI
  // prefix are registered in England and Wales).
  legalForm: "société de droit anglais (private limited company)",
  registration:
    "Companies House, Angleterre et pays de Galles (Royaume-Uni), sous le numéro 16421484",
  // Registered office, as filed at Companies House.
  address: "71-75 Shelton Street, Covent Garden, Londres WC2H 9JQ, Royaume-Uni",
  phone: "+228 79 80 03 61",
  email: "contact@kinetix-africa.com",
  publicationDirector: "[NOM DU DIRECTEUR DE LA PUBLICATION]",
  // Governing law and courts named in the terms of use — the publisher's
  // own jurisdiction.
  jurisdiction: "d'Angleterre et du pays de Galles",
} as const;

export const LEGAL_LAST_UPDATED = "30 septembre 2026";

export function isPlaceholder(value: string): boolean {
  return value.includes("[");
}
