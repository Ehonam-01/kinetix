"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { subscribeAction } from "./actions";

export function SubscribeButton({ price }: { price: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() => startTransition(() => subscribeAction())}
      className="w-full"
    >
      {pending
        ? "Redirection vers le paiement..."
        : `Payer — ${price.toLocaleString("fr-FR")} F`}
    </Button>
  );
}
