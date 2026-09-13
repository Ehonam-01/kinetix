"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { purchaseCourseAction } from "./purchase-actions";

export function PurchaseCourseButton({
  courseId,
  price,
}: {
  courseId: string;
  price: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() => startTransition(() => purchaseCourseAction(courseId))}
      className="w-full"
    >
      {pending
        ? "Redirection vers le paiement..."
        : `Acheter — ${price.toLocaleString("fr-FR")} F`}
    </Button>
  );
}
