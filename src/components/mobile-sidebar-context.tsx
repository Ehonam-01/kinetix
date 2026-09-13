"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type MobileSidebarState = { open: boolean; setOpen: (open: boolean) => void };

const MobileSidebarContext = createContext<MobileSidebarState | null>(null);

export function MobileSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

// The sidebar and the topbar's menu button live in separate components
// (dashboard/admin each have their own, nav items differ) but need to
// share one open/closed flag — a context avoids threading it back through
// the server-rendered layout as a prop.
export function useMobileSidebar() {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) {
    throw new Error(
      "useMobileSidebar must be used within a MobileSidebarProvider",
    );
  }
  return ctx;
}
