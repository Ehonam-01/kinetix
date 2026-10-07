import { MessageCircle } from "lucide-react";
import { formatWhatsapp, toWhatsappDigits, whatsappHref } from "@/lib/whatsapp";

// A downline member's WhatsApp, for their upline to reach them: the number
// (selectable) and a button opening the conversation. Members who signed up
// before the number was asked may not have one yet.
export function MemberContact({
  phone,
  memberName,
}: {
  phone: string | null;
  memberName: string;
}) {
  const digits = toWhatsappDigits(phone);
  if (!digits) {
    return (
      <p className="text-muted-foreground text-xs">
        Numéro WhatsApp non renseigné
      </p>
    );
  }
  const firstName = memberName.trim().split(/\s+/)[0] ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium tabular-nums select-all">
        {formatWhatsapp(digits)}
      </span>
      <a
        href={whatsappHref(
          digits,
          `Bonjour ${firstName}, je suis ton parrain sur Kinetix Africa.`,
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#25D366] px-2.5 text-xs font-semibold text-white hover:bg-[#1fb857]"
      >
        <MessageCircle className="size-3.5" />
        WhatsApp
      </a>
    </div>
  );
}
