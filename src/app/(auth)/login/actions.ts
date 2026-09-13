"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/schemas/auth";
import { loginUser } from "@/services/auth/login";

export async function loginAction(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { error } = await loginUser(parsed.data);
  if (error) return { error };

  redirect("/dashboard");
}
