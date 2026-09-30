import { Footer } from "@/app/_components/footer";
import { Navbar } from "@/app/_components/navbar";

export default function FormationsLayout({
  children,
}: LayoutProps<"/formations">) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
