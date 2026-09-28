import type { ReactNode } from "react";
import { Footer } from "@/app/_components/footer";
import { Navbar } from "@/app/_components/navbar";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
