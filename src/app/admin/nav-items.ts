import {
  ArrowLeftRight,
  BookOpen,
  CreditCard,
  Gift,
  Landmark,
  LayoutGrid,
  Layers,
  Percent,
  ReceiptText,
  ScrollText,
  SlidersHorizontal,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutGrid },
  { href: "/admin/members", label: "Membres", icon: Users },
  { href: "/admin/payments", label: "Paiements", icon: CreditCard },
  { href: "/admin/sales", label: "Ventes", icon: ReceiptText },
  { href: "/admin/transfers", label: "Transferts", icon: ArrowLeftRight },
  { href: "/admin/withdrawals", label: "Retraits", icon: Landmark },
  { href: "/admin/commissions", label: "Commissions", icon: TrendingUp },
  {
    href: "/admin/commission-rules",
    label: "Règles de commission",
    icon: Percent,
  },
  { href: "/admin/levels", label: "Niveaux", icon: Layers },
  { href: "/admin/rewards", label: "Récompenses", icon: Gift },
  { href: "/admin/courses", label: "Cours", icon: BookOpen },
  { href: "/admin/parameters", label: "Paramètres", icon: SlidersHorizontal },
  { href: "/admin/audit-logs", label: "Journal d'audit", icon: ScrollText },
];

// Longest-href-first match so "/admin/courses/new" resolves to "Cours", not
// falling through to the "/admin" overview entry.
export function findAdminSectionLabel(pathname: string): string {
  const sorted = [...ADMIN_NAV_ITEMS].sort(
    (a, b) => b.href.length - a.href.length,
  );
  const match = sorted.find((item) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(item.href),
  );
  return match?.label ?? "Administration";
}
