"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setMemberStatusAction } from "./actions";

export function StatusActionButton({
  userId,
  target,
  label,
}: {
  userId: string;
  target: "ACTIVE" | "SUSPENDED";
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={target === "SUSPENDED" ? "destructive" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(() => setMemberStatusAction(userId, target))
      }
    >
      {pending ? "..." : label}
    </Button>
  );
}
