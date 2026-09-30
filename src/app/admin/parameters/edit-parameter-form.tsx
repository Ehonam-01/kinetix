"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateParameterAction } from "./actions";

// unit "percent_bp": the value is stored in basis points (150) but typed
// and shown as a percentage with decimals (1,5 %). Otherwise a plain
// non-negative integer.
export function EditParameterForm({
  parameterKey,
  currentValue,
  unit,
}: {
  parameterKey: string;
  currentValue: number;
  unit?: "percent_bp";
}) {
  const isPercent = unit === "percent_bp";
  const [value, setValue] = useState(
    String(isPercent ? currentValue / 100 : currentValue),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const typed = Number(value.replace(",", "."));
  // Percentages allow two decimals (a basis point); stored as an integer.
  const stored = isPercent ? Math.round(typed * 100) : typed;
  const canSubmit =
    value.trim() !== "" &&
    Number.isFinite(typed) &&
    Number.isInteger(stored) &&
    stored >= 0 &&
    (!isPercent || Math.abs(typed * 100 - stored) < 1e-6) &&
    stored !== currentValue;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Input
            type="number"
            min={0}
            step={isPercent ? 0.01 : 1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={isPercent ? "w-32 pr-7" : "w-32"}
          />
          {isPercent && (
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm">
              %
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !canSubmit}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await updateParameterAction(parameterKey, stored);
              if (result.error) setError(result.error);
            })
          }
        >
          {pending ? "..." : "Mettre à jour"}
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
