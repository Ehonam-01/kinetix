// PayDunya's own documented coverage (developers.paydunya.com/doc/FR/
// api_softpay_index) — 7 countries, one more than Bictorys'
// (config/bictorys-countries.ts): Cameroon (MTN) has no Bictorys
// equivalent, so this list is PayDunya-specific rather than shared.
export const PAYDUNYA_COUNTRY_OPTIONS = [
  { value: "SN", label: "Sénégal" },
  { value: "CI", label: "Côte d'Ivoire" },
  { value: "BJ", label: "Bénin" },
  { value: "BF", label: "Burkina Faso" },
  { value: "ML", label: "Mali" },
  { value: "TG", label: "Togo" },
  { value: "CM", label: "Cameroun" },
] as const;
