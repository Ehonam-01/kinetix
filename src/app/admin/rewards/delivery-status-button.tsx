"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateRewardDeliveryStatusAction } from "./actions";

export function DeliveryStatusButton({
  memberRewardId,
  target,
  label,
}: {
  memberRewardId: string;
  target: "PROCESSING" | "DELIVERED";
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(() =>
          updateRewardDeliveryStatusAction(memberRewardId, target),
        )
      }
    >
      {pending ? "..." : label}
    </Button>
  );
}
