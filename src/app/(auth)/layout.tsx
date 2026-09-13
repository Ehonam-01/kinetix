import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { GridBackdrop } from "@/app/_components/grid-backdrop";
import { Logo } from "@/app/_components/logo";
import { ProductMockup } from "@/app/_components/product-mockup";

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
          <span
            aria-hidden="true"
            className="bg-primary-foreground/50 absolute top-16 right-[15%] size-1.5 rounded-full"
          />
          <span
            aria-hidden="true"
            className="bg-primary-foreground/30 absolute bottom-20 left-[12%] size-1 rounded-full"
          />

          <div className="text-primary-foreground relative max-w-sm text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Bienvenue sur {SITE_NAME}
            </h2>
            <p className="text-primary-foreground/85 mt-2 text-sm text-pretty">
              Apprenez de nouvelles compétences, suivez votre progression et
              créez de nouvelles opportunités.
            </p>
            {/* text-foreground resets the color cascade here — the mockup
                is a white/bg-card surface and expects normal dark-on-light
                text regardless of the primary_foreground panel around it. */}
            <div className="text-foreground mt-8">
              <ProductMockup />
            </div>
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
