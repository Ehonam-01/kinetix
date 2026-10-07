"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { whatsappHref } from "@/lib/whatsapp";

const SUBJECTS = [
  "Question sur les formations",
  "Inscription ou paiement de l'abonnement",
  "Programme ambassadeur",
  "Retrait ou commissions",
  "Problème technique",
  "Autre",
] as const;

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 w-full rounded-lg border bg-transparent px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm";

// The contact form: nothing is stored or sent by the site — it writes the
// message and opens a WhatsApp conversation with the support number set by
// the admin (admin → Paiements → WhatsApp du support), where the visitor
// just presses send. Without that number, the support email is offered.
export function ContactForm({
  whatsapp,
  email,
  defaultName = "",
  defaultUsername = "",
}: {
  whatsapp: string | null;
  email: string;
  defaultName?: string;
  defaultUsername?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [username, setUsername] = useState(defaultUsername);
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!whatsapp) {
    return (
      <p className="text-muted-foreground text-sm">
        Écris-nous à{" "}
        <span className="text-foreground font-medium select-all">{email}</span>,
        nous te répondrons rapidement.
      </p>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Indique ton nom.");
      return;
    }
    if (message.trim().length < 10) {
      setError(
        "Ton message est trop court : décris ta demande en quelques mots.",
      );
      return;
    }
    const text = [
      "Bonjour Kinetix Africa,",
      "",
      `Nom : ${name.trim()}`,
      ...(username.trim() ? [`Pseudo : ${username.trim()}`] : []),
      `Sujet : ${subject}`,
      "",
      message.trim(),
    ].join("\n");
    window.open(whatsappHref(whatsapp!, text), "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Nom complet</Label>
          <Input
            id="contact-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-username">
            Pseudo{" "}
            <span className="text-muted-foreground">(si tu es membre)</span>
          </Label>
          <Input
            id="contact-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-subject">Sujet</Label>
        <select
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={SELECT_CLASS}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <textarea
          id="contact-message"
          rows={6}
          maxLength={1500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Décris ta demande…"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-3 md:text-sm"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button
        type="submit"
        size="lg"
        className="w-full bg-[#25D366] text-white hover:bg-[#1fb857] sm:w-auto"
      >
        <MessageCircle className="size-4" />
        Envoyer sur WhatsApp
      </Button>
      <p className="text-muted-foreground text-xs">
        WhatsApp s&apos;ouvre avec ton message déjà rédigé : il ne te reste
        qu&apos;à appuyer sur Envoyer.
      </p>
    </form>
  );
}
