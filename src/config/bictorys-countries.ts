// The 6 countries Bictorys currently covers (their own hosted checkout
// page's country picker) — shared by every country selector (subscription
// payment, withdrawal request). ISO 3166-1 alpha-2, matching what
// services/payments/bictorys.ts and bictorys-payout.ts send as "country".
export const BICTORYS_COUNTRY_OPTIONS = [
  { value: "SN", label: "Sénégal" },
  { value: "CI", label: "Côte d'Ivoire" },
  { value: "BJ", label: "Bénin" },
  { value: "BF", label: "Burkina Faso" },
  { value: "ML", label: "Mali" },
  { value: "TG", label: "Togo" },
] as const;
