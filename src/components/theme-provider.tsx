"use client";

import * as React from "react";

const STORAGE_KEY = "theme";
type Theme = "light" | "dark";

type ThemeContextValue = {
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined,
);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Replaces next-themes: its own anti-flash <script> is rendered by a Client
// Component (React.createElement("script", ...) on every render), which is
// exactly what React 19 warns about ("Encountered a script tag while
// rendering React component") — and on this Next 16 / React 19 canary
// combination that warning came with the page failing to render, not just
// console noise. The actual anti-flash script now lives in layout.tsx as a
// real Server Component <script> (see components/inline-script.tsx and
// Next's own guide on preventing flash before hydration) — this provider
// only holds the React state/context side, in sync with the same
// localStorage key the inline script reads.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [resolvedTheme, setResolvedTheme] =
    React.useState<Theme>(readStoredTheme);

  // React's Strict Mode dev remount clears the class the inline script set
  // on <html> before React ever mounted (see "Re-applying attributes in
  // development" in the guide above) — reapply it here. A no-op in
  // production, where the inline script alone is enough.
  React.useLayoutEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = React.useCallback((theme: Theme) => {
    setResolvedTheme(theme);
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private browsing / disabled storage — the theme still switches for
      // this page view, it just won't persist across a reload.
    }
  }, []);

  const value = React.useMemo(
    () => ({ resolvedTheme, setTheme }),
    [resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
