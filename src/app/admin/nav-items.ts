import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  Clapperboard,
  Compass,
  CreditCard,
  Gift,
  GraduationCap,
  HandCoins,
  Landmark,
  LayoutGrid,
  Layers,
  LifeBuoy,
  MessagesSquare,
  Percent,
  PiggyBank,
  Presentation,
  ReceiptText,
  ScrollText,
  SlidersHorizontal,
  Star,
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
  { href: "/admin/recharge", label: "Recharger un compte", icon: HandCoins },
  { href: "/admin/payments", label: "Paiements", icon: CreditCard },
  { href: "/admin/marketing", label: "Marketing", icon: BarChart3 },
  {
    href: "/admin/subscriptions",
    label: "Abonnements",
    icon: CalendarClock,
  },
  { href: "/admin/installments", label: "Cagnottes", icon: PiggyBank },
  { href: "/admin/sales", label: "Ventes (historique)", icon: ReceiptText },
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
  { href: "/admin/mentors", label: "Mentorat", icon: GraduationCap },
  { href: "/admin/trainers", label: "Formateurs", icon: Presentation },
  { href: "/admin/orientation", label: "Orientation", icon: Compass },
  { href: "/admin/atelier", label: "Atelier", icon: Clapperboard },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/courses", label: "Cours", icon: BookOpen },
  { href: "/admin/discussions", label: "Discussions", icon: MessagesSquare },
  { href: "/admin/reviews", label: "Avis des formations", icon: Star },
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
