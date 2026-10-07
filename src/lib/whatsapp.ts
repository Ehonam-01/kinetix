// A member's WhatsApp number, kept as the international number in digits
// only ("22890000000") — what a wa.me link wants. Typed any usual way:
// "+228 90 00 00 00", "00228-90.00.00.00", "22890000000". Pure, shared by
// the sign-up and profile forms (schemas) and the pages that show it.
export function toWhatsappDigits(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  let digits = input.trim().replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export const WHATSAPP_FORMAT_ERROR =
  "Numéro WhatsApp invalide : indique l'indicatif du pays, par exemple +228 90 00 00 00.";

// "+228 90000000"-style display of a stored number.
export function formatWhatsapp(digits: string): string {
  return `+${digits}`;
}

export function whatsappHref(digits: string, text?: string): string {
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
