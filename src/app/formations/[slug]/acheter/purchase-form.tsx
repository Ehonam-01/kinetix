"use client";

import { PaydunyaSubscribeForm } from "@/app/dashboard/subscription/paydunya-subscribe-form";
import { buyCourseAction } from "./actions";

// The mobile money form of the subscription, charging this course's price.
// Once confirmed, the page refreshes and opens the course.
export function CoursePurchaseForm({
  courseId,
  price,
  otherCountries,
}: {
  courseId: string;
  price: number;
  otherCountries: boolean;
}) {
  return (
    <PaydunyaSubscribeForm
      price={price}
      submitLabel={`Payer ${price.toLocaleString("fr-FR")} F`}
      otherCountries={otherCountries}
      start={(country, operator, phone, otp, address) =>
        buyCourseAction(courseId, country, operator, phone, otp, address)
      }
    />
  );
}
