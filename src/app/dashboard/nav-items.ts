import {
  ArrowLeftRight,
  BookOpen,
  CalendarClock,
  CreditCard,
  Gift,
  Landmark,
  LayoutGrid,
  Layers,
  Settings,
  Share2,
  Users2,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Sections meaningful only to an ambassador (section 24 of the master
  // prompt) — hidden from a plain customer (section 23: never show them the
  // MLM tree, commissions, generations, level, or ambassador balance).
  // Filtered at render time (dashboard-sidebar.tsx), not removed from this
  // list, so findDashboardSectionLabel below still resolves every possible
  // path regardless of who's viewing it.
  ambassadorOnly?: boolean;
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutGrid },
  {
    href: "/dashboard/network",
    label: "Mon réseau",
    icon: Share2,
    ambassadorOnly: true,
  },
  {
    href: "/dashboard/commissions",
    label: "Commissions",
    icon: CreditCard,
    ambassadorOnly: true,
  },
  {
    href: "/dashboard/transfer",
    label: "Transférer",
    icon: ArrowLeftRight,
    ambassadorOnly: true,
  },
  {
    href: "/dashboard/withdrawals",
    label: "Retraits",
    icon: Landmark,
    ambassadorOnly: true,
  },
  {
    href: "/dashboard/levels",
    label: "Niveaux",
    icon: Layers,
    ambassadorOnly: true,
  },
  { href: "/dashboard/courses", label: "Cours", icon: BookOpen },
  { href: "/dashboard/community", label: "Communauté", icon: Users2 },
  {
    href: "/dashboard/subscription",
    label: "Mon abonnement",
    icon: CalendarClock,
  },
  {
    href: "/dashboard/rewards",
    label: "Récompenses",
    icon: Gift,
    ambassadorOnly: true,
  },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
];

// Longest-href-first match so "/dashboard/courses/[id]" resolves to
// "Cours", not falling through to the "/dashboard" overview entry.
export function findDashboardSectionLabel(pathname: string): string {
  const sorted = [...DASHBOARD_NAV_ITEMS].sort(
    (a, b) => b.href.length - a.href.length,
  );
  const match = sorted.find((item) =>
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href),
  );
  return match?.label ?? "Tableau de bord";
}
