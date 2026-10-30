"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { grantSubscriptionCreditAction } from "./actions";

export function GrantSubscriptionButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await grantSubscriptionCreditAction(userId);
          if (result.error) alert(result.error);
        })
      }
    >
      {pending ? "..." : "Accorder un abonnement (1 an)"}
    </Button>
  );
}
