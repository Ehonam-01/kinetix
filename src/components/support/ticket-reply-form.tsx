"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type Result = { error: string | null };

// Reply box under a ticket's conversation, shared by the member and the
// admin pages — each passes its own Server Action. secondary: a second
// submit button for the same message (e.g. "Répondre et fermer").
export function TicketReplyForm({
  onReply,
  placeholder,
  submitLabel = "Envoyer",
  secondary,
}: {
  onReply: (body: string) => Promise<Result>;
  placeholder: string;
  submitLabel?: string;
  secondary?: { label: string; onReply: (body: string) => Promise<Result> };
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(action: (body: string) => Promise<Result>) {
    setError(null);
    if (body.trim().length < 10) {
      setError("Ton message est trop court : quelques mots de plus.");
      return;
    }
    startTransition(async () => {
      const result = await action(body);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(onReply);
      }}
      className="space-y-3"
      noValidate
    >
      <textarea
        rows={5}
        maxLength={3000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        aria-label="Message"
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-3 md:text-sm"
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          <Send className="size-4" />
          {pending ? "Envoi…" : submitLabel}
        </Button>
        {secondary && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => send(secondary.onReply)}
          >
            {secondary.label}
          </Button>
        )}
      </div>
    </form>
  );
}
