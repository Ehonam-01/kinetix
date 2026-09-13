"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Search, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMobileSidebar } from "@/components/mobile-sidebar-context";
import { findAdminSectionLabel } from "./nav-items";

export function AdminTopBar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { setOpen } = useMobileSidebar();
  const title = findAdminSectionLabel(pathname);
  const initial = adminName.trim().charAt(0).toUpperCase() || "A";

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim() === "") return;
    router.push(`/admin/members?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="border-border bg-card border-b px-4 pt-6 pb-8 sm:rounded-tr-3xl sm:px-8">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="bg-muted hover:bg-accent flex size-9 shrink-0 items-center justify-center rounded-full lg:hidden"
          >
            <Menu className="size-4" />
          </button>
          <form onSubmit={handleSearch} className="relative w-full max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un membre..."
              className="bg-muted placeholder:text-muted-foreground focus:ring-ring w-full rounded-full py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
            />
          </form>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Link
            href="/admin/audit-logs"
            title="Journal d'audit"
            className="bg-muted hover:bg-accent hidden size-9 items-center justify-center rounded-full sm:flex"
          >
            <Bell className="size-4" />
          </Link>
          <Link
            href="/admin/parameters"
            title="Paramètres"
            className="bg-muted hover:bg-accent hidden size-9 items-center justify-center rounded-full sm:flex"
          >
            <Settings className="size-4" />
          </Link>
          <div className="bg-muted flex items-center gap-2 rounded-full py-1 pr-1 pl-1 sm:pr-3">
            <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-xs font-semibold">
              {initial}
            </div>
            <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
              {adminName}
            </span>
          </div>
        </div>
      </div>

      <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
    </div>
  );
}
