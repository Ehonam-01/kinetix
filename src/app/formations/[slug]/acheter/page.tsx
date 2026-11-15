import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Infinity as InfinityIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { cn } from "@/lib/utils";
import { getPublicCourse, hasCourseAccess } from "@/repositories/courses";
import { isSaspayEnabled } from "@/repositories/payment-settings";
import { getCurrentUser } from "@/services/auth/current-user";
import { coursePurchaseRefusal } from "@/services/lms/course-purchase";
import { CoursePurchaseForm } from "./purchase-form";

export const metadata: Metadata = {
  title: "Acheter la formation",
  robots: { index: false, follow: true },
};

// One course bought on its own, for life (explicit user decision): sign in
// or create a learner account first, then pay by mobile money. Read for
// each visit (the visitor's own account).
export default async function BuyCoursePage(
  props: PageProps<"/formations/[slug]/acheter">,
) {
  const { slug } = await props.params;
  const content = await getPublicCourse(db, slug);
  if (!content || content.course.salePrice === null) notFound();
  const { course } = content;
  const price = course.salePrice!;
  const coursePath = `/formations/${course.slug ?? course.id}`;
  const here = `${coursePath}/acheter`;
  const current = await getCurrentUser();

  let body: React.ReactNode;
  if (!current) {
    body = (
      <div className="space-y-3">
        <p className="text-sm">
          Crée ton compte pour payer, puis retrouver ta formation quand tu veux.
        </p>
        <Link
          href={`/register?formation=${encodeURIComponent(course.slug ?? course.id)}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Créer mon compte
        </Link>
        <Link
          href={`/login?next=${encodeURIComponent(here)}`}
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "w-full",
          )}
        >
          J&apos;ai déjà un compte
        </Link>
      </div>
    );
  } else if (await hasCourseAccess(db, current.profile.id, course.id)) {
    body = (
      <div className="space-y-3 text-center">
        <CheckCircle2 className="mx-auto size-10 text-green-600" />
        <p className="font-medium">Tu as accès à cette formation.</p>
        <Link
          href={`/dashboard/courses/${course.id}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Commencer la formation
        </Link>
      </div>
    );
  } else {
    const refusal = await coursePurchaseRefusal(db, current.profile, course);
    body = refusal ? (
      <div className="space-y-3">
        <p className="text-sm">{refusal}</p>
        {current.profile.accountType === "MEMBER" && (
          <Link
            href="/dashboard/subscription"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Mon abonnement
          </Link>
        )}
      </div>
    ) : (
      <CoursePurchaseForm
        courseId={course.id}
        price={price}
        otherCountries={await isSaspayEnabled(db)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
      <Link
        href={coursePath}
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Retour à la formation
      </Link>
      <div className="bg-card mt-3 space-y-5 rounded-2xl border p-5 sm:p-6">
        <div>
          <p className="text-muted-foreground text-sm">Acheter la formation</p>
          <h1 className="font-heading mt-1 text-xl font-bold">
            {course.title}
          </h1>
          <p className="mt-3 text-3xl font-extrabold tabular-nums">
            {price.toLocaleString("fr-FR")} F
          </p>
          <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
            <InfinityIcon aria-hidden="true" className="size-4 shrink-0" />
            Accès à vie à cette formation, en un seul paiement.
          </p>
        </div>
        {body}
        <p className="text-muted-foreground border-t pt-4 text-xs">
          Tu veux tout le catalogue ?{" "}
          <Link href="/register" className="underline">
            L&apos;abonnement annuel
          </Link>{" "}
          donne accès à toutes les formations. Le prix de cette formation
          n&apos;en est pas déduit.
        </p>
      </div>
    </div>
  );
}
