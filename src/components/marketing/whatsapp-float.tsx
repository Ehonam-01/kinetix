import { db } from "@/db/client";
import { whatsappHref } from "@/lib/whatsapp";
import { getSupportWhatsapp } from "@/repositories/payment-settings";
import { WhatsappFloatButton } from "./whatsapp-float-button";

const MESSAGE =
  "Bonjour Kinetix Africa, je voudrais des informations sur l'abonnement.";

// The WhatsApp button in the corner of the public pages (explicit user
// decision), to the support number set in Admin → Paiements — the same one
// the contact form writes to. No number set, or the database out of reach:
// no button, never a broken page.
export async function WhatsappFloat() {
  let digits: string | null = null;
  try {
    digits = await getSupportWhatsapp(db);
  } catch (error) {
    console.error("WhatsApp du support illisible :", error);
  }
  if (!digits) return null;
  return <WhatsappFloatButton href={whatsappHref(digits, MESSAGE)} />;
}
