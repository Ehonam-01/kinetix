"use client";

import { useState, useTransition } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendSubscriptionReminderAction } from "./actions";

// "Relancer" on a member who hasn't paid: an email sent by the site (once a
// day at most), or WhatsApp opened with the same message ready to send.
export function SubscriptionReminder({
  userId,
  whatsappUrl,
  lastReminderLabel,
}: {
  userId: string;
  // null when the member has no WhatsApp number.
  whatsappUrl: string | null;
  lastReminderLabel: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function sendEmail() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendSubscriptionReminderAction(userId);
      setMessage(
        result.error
          ? { ok: false, text: result.error }
          : { ok: true, text: "Email de relance envoyé." },
      );
    });
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">Relancer le membre</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={sendEmail}
        >
          <Mail className="size-4" />
          {pending ? "Envoi…" : "Relancer par email"}
        </Button>
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-sm font-medium text-white hover:bg-[#1fb857]"
          >
            <MessageCircle className="size-4" />
            Relancer sur WhatsApp
          </a>
        ) : (
          <span className="text-muted-foreground self-center text-xs">
            Pas de numéro WhatsApp renseigné.
          </span>
        )}
      </div>
      {message && (
        <p
          className={
            message.ok ? "text-sm text-green-600" : "text-destructive text-sm"
          }
        >
          {message.text}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        {lastReminderLabel
          ? `Dernière relance par email : ${lastReminderLabel}.`
          : "Jamais relancé par email."}{" "}
        Un email de relance par jour au maximum.
      </p>
    </div>
  );
}
