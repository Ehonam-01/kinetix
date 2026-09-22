import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { FloatingBubbles } from "@/app/_components/floating-bubbles";
import { GridBackdrop } from "@/app/_components/grid-backdrop";
import { Logo } from "@/app/_components/logo";
import { MediaSlot } from "@/app/_components/media-slot";

// Shared by every (auth) page — login, register, forgot/reset password —
// so the whole auth flow reads as one consistent, branded experience
// instead of just the login screen getting the treatment. Below lg it's
// still the plain full-bleed single-column form (nothing to split on a
// phone); at lg the two panels sit inside one bounded, floating card
// instead of stretching to the viewport edges, so they read as one
// composition instead of two independent halves.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="from-primary/15 via-background to-accent/40 flex min-h-full flex-1 items-center justify-center lg:bg-linear-to-br lg:p-8">
      <div className="border-border bg-card flex w-full flex-col overflow-hidden lg:max-w-5xl lg:flex-row lg:rounded-3xl lg:border lg:shadow-2xl">
        <div className="from-primary to-primary/70 relative hidden overflow-hidden bg-linear-to-br lg:flex lg:w-[44%] lg:flex-col lg:items-center lg:justify-center lg:px-10 lg:py-12">
          <GridBackdrop className="opacity-[0.12]" />
          <FloatingBubbles />

          <div className="text-primary-foreground relative max-w-sm text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Bienvenue sur {SITE_NAME}
            </h2>
            <p className="text-primary-foreground/85 mt-2 text-sm text-pretty">
              Le repère de celles et ceux qui se préparent à l&apos;avenir :
              formations pratiques, mentorat réel et communauté qui avance.
            </p>
            <MediaSlot
              src="/community-photo.png"
              alt="Membres de la communauté Kinetix qui échangent"
              brief="Photo ou capture : des membres réels qui discutent, collaborent ou se rencontrent."
              className="border-primary-foreground/20 mt-8 aspect-video w-full overflow-hidden rounded-2xl border shadow-2xl"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-12">
          <Link href="/" className="mb-8 flex items-center self-start">
            <Logo />
          </Link>
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
