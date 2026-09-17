import type { Metadata } from "next";
import { db } from "@/db/client";
import { Navbar } from "@/app/_components/navbar";
import { Footer } from "@/app/_components/footer";
import { SITE_NAME } from "@/config/site";
import { getCompensationData } from "./data";
import { PaHero } from "./_components/pa-hero";
import { PaProgramIntro } from "./_components/pa-program-intro";
import { PaCompensation } from "./_components/pa-compensation";
import { PaProgression } from "./_components/pa-progression";
import { PaBenefits } from "./_components/pa-benefits";
import { PaObjections } from "./_components/pa-objections";
import { PaFinalCta } from "./_components/pa-final-cta";
import { PaTrustNote } from "./_components/pa-trust-note";

const TITLE = `Programme ambassadeur — ${SITE_NAME}`;
const DESCRIPTION =
  "Découvre le programme ambassadeur Kinetix Africa : recommande les formations, sois rémunéré sur les souscriptions réelles.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/programme-ambassadeur" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/programme-ambassadeur",
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Same reasoning as app/page.tsx: no cookies/headers/searchParams, so this
// prerenders statically — the revalidate window keeps the live commission
// rates (data.ts) from silently drifting from what an admin actually
// configures between deploys.
export const revalidate = 600;

export default async function ProgrammeAmbassadeurPage() {
  const compensation = await getCompensationData(db);

  return (
    <>
      <Navbar />
      <main>
        <PaHero />
        <PaProgramIntro />
        <PaCompensation data={compensation} />
        <PaProgression />
        <PaBenefits />
        <PaObjections />
        <PaFinalCta />
      </main>
      <PaTrustNote />
      <Footer />
    </>
  );
}
