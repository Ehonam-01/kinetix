import { Footer } from "@/app/_components/footer";
import { Navbar } from "@/app/_components/navbar";

export default function OrientationGoalLayout({
  children,
}: LayoutProps<"/orientation/[objectif]">) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
