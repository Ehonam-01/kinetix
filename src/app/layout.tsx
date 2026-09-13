import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Sets the .dark class on <html> before the browser paints, matching the
// storage key theme-provider.tsx reads/writes — see InlineScript for why
// this avoids React 19's "script tag" warning. No class = light, the
// existing default.
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;

// Poppins isn't a variable font on Google Fonts, so next/font needs an
// explicit weight list rather than the single "variable" axis Geist used.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plateforme MLM & Formation",
  description: "Plateforme de formation en ligne avec progression MLM binaire.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${poppins.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
