"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  sendAllGraceRemindersAction,
  sendGraceReminderAction,
} from "./actions";

export function GraceReminderButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendGraceReminderAction(userId);
            setMessage(result.error ?? "Relance envoyée.");
          })
        }
      >
        <Send className="size-3.5" />
        {pending ? "Envoi..." : "Relancer"}
      </Button>
      {message && (
        <span className="text-muted-foreground max-w-48 text-right text-xs">
          {message}
        </span>
      )}
    </div>
  );
}

export function GraceReminderAllButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className="text-muted-foreground text-xs">{message}</span>
      )}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { sent, failed } = await sendAllGraceRemindersAction();
            setMessage(
              `${sent} relance(s) envoyée(s)${failed ? `, ${failed} en échec` : ""}.`,
            );
          })
        }
      >
        <Send className="size-3.5" />
        {pending ? "Envoi..." : `Relancer les ${count}`}
      </Button>
    </div>
  );
}
