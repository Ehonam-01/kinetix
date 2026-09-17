import type { Metadata } from "next";
import { db } from "@/db/client";
import { listPublishedCoursesForMarketing } from "@/repositories/courses";
import { SITE_NAME } from "@/config/site";
import { Navbar } from "./_components/navbar";
import { HeroSection } from "./_components/hero-section";
import { ProblemSection } from "./_components/problem-section";
import { ValueSection } from "./_components/value-section";
import { GoalSection } from "./_components/goal-section";
import { FeaturedCourses } from "./_components/featured-courses";
import { AiSection } from "./_components/ai-section";
import { CommunityMentorshipSection } from "./_components/community-mentorship-section";
import { ProjectsOpportunitiesSection } from "./_components/projects-opportunities-section";
import { HowItWorks } from "./_components/how-it-works";
import { LearnerAmbassadorSection } from "./_components/learner-ambassador-section";
import { AmbassadorSection } from "./_components/ambassador-section";
import { FaqSection } from "./_components/faq-section";
import { FinalCta } from "./_components/final-cta";
import { Footer } from "./_components/footer";

const TITLE = `${SITE_NAME} — Formations, mentorat et communauté pour la jeunesse de demain`;
const DESCRIPTION =
  "Le repère de celles et ceux qui se préparent à l'avenir : formations pratiques, mentorat réel et communauté pour affronter un monde bouleversé par l'intelligence artificielle.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
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

// This route has no cookies/headers/searchParams, so Next.js prerenders it
// statically at build time (fastest possible serve — see section 26 of the
// brief). Without a revalidate window that build-time snapshot would only
// ever refresh on the next deploy, so a course an admin just published
// wouldn't show up here on its own — ISR keeps the static-speed win while
// still picking up catalog changes within this window.
export const revalidate = 600;

export default async function HomePage() {
  const courses = await listPublishedCoursesForMarketing(db, 6);

  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <ValueSection />
        <GoalSection />
        <FeaturedCourses courses={courses} />
        <AiSection />
        <CommunityMentorshipSection />
        <ProjectsOpportunitiesSection />
        <HowItWorks />
        <LearnerAmbassadorSection />
        <AmbassadorSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
