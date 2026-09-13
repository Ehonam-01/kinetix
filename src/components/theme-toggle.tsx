"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

// Rendered inside the topbars (dashboard + admin) — a plain icon button, not
// the shadcn Button component, so it can sit inline with the other
// icon-circle controls already there (search/notifications/settings).
//
// Both icons always render; only CSS (the dark: variant, driven by the
// .dark class the inline script in layout.tsx puts on <html> before
// hydration) decides which one shows — avoids the classic "mounted"
// useState+useEffect gate some theme-toggle examples use to dodge a
// hydration mismatch, which this project's stricter
// react-hooks/set-state-in-effect rule rejects anyway.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      title="Changer de thème"
      className={cn(
        "bg-muted text-foreground hover:bg-accent relative flex size-9 items-center justify-center rounded-full",
        className,
      )}
    >
      <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Changer de thème</span>
    </button>
  );
}
