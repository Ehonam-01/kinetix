"use server";

import { redirect } from "next/navigation";
import { logoutUser } from "@/services/auth/logout";

export async function logoutAction() {
  await logoutUser();
  redirect("/login");
}
