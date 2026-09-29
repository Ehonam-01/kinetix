"use client";

import { useRef, useState } from "react";
import { Bold, Heading2, Link2, List, ListOrdered, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LessonContent } from "@/components/lesson-content";

type Edit = {
  before: string;
  after?: string;
  placeholder: string;
  line?: boolean;
};

const TOOLS: { label: string; icon: typeof Bold; edit: Edit }[] = [
  {
    label: "Titre",
    icon: Heading2,
    edit: { before: "## ", placeholder: "Titre", line: true },
  },
  {
    label: "Gras",
    icon: Bold,
    edit: { before: "**", after: "**", placeholder: "texte en gras" },
  },
  {
    label: "Liste",
    icon: List,
    edit: { before: "- ", placeholder: "élément", line: true },
  },
  {
    label: "Liste numérotée",
    icon: ListOrdered,
    edit: { before: "1. ", placeholder: "étape", line: true },
  },
  {
    label: "Encadré",
    icon: Quote,
    edit: { before: "> ", placeholder: "astuce", line: true },
  },
  {
    label: "Lien",
    icon: Link2,
    edit: { before: "[", after: "](https://)", placeholder: "texte du lien" },
  },
];

// A Markdown textarea with a live preview rendered by the exact component
// learners see (LessonContent) — side by side on a wide screen, as tabs on
// a phone. The toolbar only inserts plain Markdown syntax.
export function MarkdownEditor({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  function apply({ before, after = "", placeholder, line }: Edit) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    // Line-level syntax (titles, lists, quotes) must start a line.
    const prefix =
      line && start > 0 && value[start - 1] !== "\n" ? `\n${before}` : before;
    const next =
      value.slice(0, start) + prefix + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const from = start + prefix.length;
      el.setSelectionRange(from, from + selected.length);
    });
  }

  return (
    <div className="border-input overflow-hidden rounded-lg border">
      <div className="bg-muted/40 border-input flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
        {TOOLS.map(({ label, icon: Icon, edit }) => (
          <Button
            key={label}
            type="button"
            size="icon-xs"
            variant="ghost"
            title={label}
            aria-label={label}
            onClick={() => {
              setTab("write");
              apply(edit);
            }}
          >
            <Icon />
          </Button>
        ))}
        <div className="ml-auto flex gap-1 lg:hidden">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                tab === t ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {t === "write" ? "Écrire" : "Aperçu"}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto hidden text-xs lg:inline">
          Aperçu tel que le verront les apprenants →
        </span>
      </div>
      <div className="lg:grid lg:grid-cols-2">
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={18}
          placeholder={"## Introduction\n\nÉcris ta leçon ici…"}
          className={cn(
            "block min-h-80 w-full resize-y bg-transparent p-3 font-mono text-sm outline-none lg:block",
            tab === "preview" && "hidden",
          )}
        />
        <div
          className={cn(
            "border-input max-h-[36rem] min-h-80 overflow-y-auto p-4 lg:block lg:border-l",
            tab === "write" && "hidden",
          )}
        >
          {value.trim() ? (
            <LessonContent markdown={value} />
          ) : (
            <p className="text-muted-foreground text-sm">
              L&apos;aperçu apparaîtra ici.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
