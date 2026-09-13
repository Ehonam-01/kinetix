import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/config/site";
import { Logo } from "./logo";

// A plain <span> stands in for links to pages that don't exist yet
// (legal/support pages — building those is out of this task's scope) so
// the footer keeps its expected structure without shipping dead links.
function FooterLink({ href, children }: { href?: string; children: string }) {
  if (!href) {
    return <span className="text-muted-foreground/60 text-sm">{children}</span>;
  }
  const isAnchor = href.startsWith("#") || href.startsWith("/");
  return isAnchor ? (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
    >
      {children}
    </Link>
  ) : (
    <a
      href={href}
      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
    >
      {children}
    </a>
  );
}

const COLUMNS: { title: string; links: { label: string; href?: string }[] }[] =
  [
    {
      title: "Plateforme",
      links: [
        { label: "Accueil", href: "/" },
        { label: "Formations", href: "#formations" },
        { label: "À propos" },
        { label: "Contact" },
      ],
    },
    {
      title: "Apprendre",
      links: [
        { label: "Toutes les formations", href: "#formations" },
        { label: "Catégories" },
        { label: "Certificats" },
      ],
    },
    {
      title: "Ambassadeurs",
      links: [
        { label: "Programme ambassadeur", href: "#ambassadeurs" },
        { label: "Conditions" },
        { label: "Règles de rémunération" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "FAQ", href: "#faq" },
        { label: "Contact" },
        { label: "Politique de remboursement" },
      ],
    },
    {
      title: "Légal",
      links: [
        { label: "Conditions générales" },
        { label: "Politique de confidentialité" },
        { label: "Politique de remboursement" },
        { label: "Mentions légales" },
      ],
    },
  ];

export function Footer() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center">
              <Logo />
            </Link>
            <p className="text-muted-foreground mt-3 max-w-[28ch] text-sm leading-relaxed">
              {SITE_TAGLINE}
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border mt-10 border-t pt-6">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {SITE_NAME}. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
