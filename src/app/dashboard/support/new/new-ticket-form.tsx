"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORT_CATEGORIES } from "@/config/support";
import { createTicketAction } from "../actions";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 w-full rounded-lg border bg-transparent px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm";

export function NewTicketForm() {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      // Redirects to the new ticket on success.
      const result = await createTicketAction({ category, subject, message });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="ticket-category">Sujet</Label>
        <select
          id="ticket-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="" disabled>
            Choisis un sujet
          </option>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-subject">Titre</Label>
        <Input
          id="ticket-subject"
          value={subject}
          maxLength={120}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ex : Mon paiement n'apparaît pas"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticket-message">Message</Label>
        <textarea
          id="ticket-message"
          rows={7}
          maxLength={3000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Décris ta demande : ce que tu as fait, ce qui s'est passé, et ce que tu attendais."
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-3 md:text-sm"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        <Send className="size-4" />
        {pending ? "Envoi…" : "Envoyer le ticket"}
      </Button>
    </form>
  );
}
