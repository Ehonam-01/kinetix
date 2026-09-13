"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { claimRewardAction } from "./actions";

export function ClaimRewardForm({
  memberRewardId,
  requiresAddress,
}: {
  memberRewardId: string;
  requiresAddress: boolean;
}) {
  const [address, setAddress] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {requiresAddress && (
        <Input
          placeholder="Adresse de livraison"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-48"
        />
      )}
      <Button
        size="sm"
        disabled={pending || (requiresAddress && address.trim() === "")}
        onClick={() =>
          startTransition(() =>
            claimRewardAction(memberRewardId, address || undefined),
          )
        }
      >
        {pending ? "..." : "Réclamer"}
      </Button>
    </div>
  );
}
