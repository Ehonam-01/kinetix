import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import { PWA_INSTALL_CAPTURE_SCRIPT } from "@/components/pwa/install-app-banner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_NAME } from "@/config/site";
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
  // Absolute base for every page's canonical/Open Graph URLs (link
  // previews on WhatsApp/Facebook, search engines) — the production
  // address, not whichever deployment URL served the page.
  metadataBase: process.env.SITE_URL
    ? new URL(process.env.SITE_URL)
    : undefined,
  title: SITE_NAME,
  description: "Formations, mentorat et communauté pour la jeunesse de demain.",
  // Installed on an iPhone's home screen (app/manifest.ts covers Android):
  // opens full screen, under this name.
  appleWebApp: {
    capable: true,
    title: "Kinetix",
    statusBarStyle: "default",
  },
};

// Browser bar / installed app's status bar, matching the page background
// in each theme (--background in globals.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
        <InlineScript html={PWA_INSTALL_CAPTURE_SCRIPT} />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
