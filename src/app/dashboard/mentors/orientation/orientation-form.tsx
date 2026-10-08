"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOAL_OPTIONS } from "@/config/goals";
import {
  LEVEL_OPTIONS,
  SITUATION_OPTIONS,
  WEEKLY_TIME_OPTIONS,
} from "@/config/orientation";
import { submitOrientationRequestAction } from "./actions";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 w-full rounded-lg border bg-transparent px-2.5 text-base outline-none focus-visible:ring-3 md:text-sm";

type Option = { value: string; label: string };

function Choice({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function OrientationForm({ defaultGoal }: { defaultGoal: string }) {
  const router = useRouter();
  const [goal, setGoal] = useState(defaultGoal);
  const [situation, setSituation] = useState("");
  const [level, setLevel] = useState("");
  const [weeklyTime, setWeeklyTime] = useState("");
  const [interests, setInterests] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitOrientationRequestAction({
        goal,
        situation,
        level,
        weeklyTime,
        interests,
        message,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Choice
        id="orientation-goal"
        label="Que veux-tu accomplir ?"
        options={GOAL_OPTIONS}
        value={goal}
        onChange={setGoal}
        placeholder="Choisis ton objectif"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice
          id="orientation-situation"
          label="Ta situation actuelle"
          options={SITUATION_OPTIONS}
          value={situation}
          onChange={setSituation}
          placeholder="Choisis"
        />
        <Choice
          id="orientation-level"
          label="Ton niveau dans ce domaine"
          options={LEVEL_OPTIONS}
          value={level}
          onChange={setLevel}
          placeholder="Choisis"
        />
      </div>
      <Choice
        id="orientation-time"
        label="Le temps que tu peux y consacrer"
        options={WEEKLY_TIME_OPTIONS}
        value={weeklyTime}
        onChange={setWeeklyTime}
        placeholder="Choisis"
      />
      <div className="space-y-2">
        <Label htmlFor="orientation-interests">
          Les domaines qui t&apos;intéressent
        </Label>
        <Input
          id="orientation-interests"
          value={interests}
          maxLength={200}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="Ex : marketing digital, IA, vente en ligne…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="orientation-message">
          Dis-nous en plus{" "}
          <span className="text-muted-foreground">(facultatif)</span>
        </Label>
        <textarea
          id="orientation-message"
          rows={5}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ton projet, ce qui te bloque, ce que tu attends de Kinetix…"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-3 md:text-sm"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        <Send className="size-4" />
        {pending ? "Envoi…" : "Envoyer à l'équipe"}
      </Button>
    </form>
  );
}
