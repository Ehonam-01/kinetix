"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateParameterAction } from "./actions";

export function EditParameterForm({
  parameterKey,
  currentValue,
}: {
  parameterKey: string;
  currentValue: number;
}) {
  const [value, setValue] = useState(String(currentValue));
  const [pending, startTransition] = useTransition();

  const parsed = Number(value);
  const canSubmit =
    value.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= 0 &&
    parsed !== currentValue;

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-32"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !canSubmit}
        onClick={() =>
          startTransition(() => updateParameterAction(parameterKey, parsed))
        }
      >
        {pending ? "..." : "Mettre à jour"}
      </Button>
    </div>
  );
}
