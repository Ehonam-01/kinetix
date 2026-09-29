import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/config/site";

// What makes the site installable on a phone's home screen (Next.js PWA
// guide). The installed app opens on the member's dashboard — an app
// launch is someone coming back, not a visitor — and /dashboard sends a
// signed-out person to the login page on its own.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_NAME,
    short_name: "Kinetix",
    description: SITE_TAGLINE,
    lang: "fr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // --background of globals.css (light theme): the splash screen and the
    // title bar — same as the viewport themeColor in app/layout.tsx.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["education", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press on the app icon (Android).
    shortcuts: [
      {
        name: "Mes formations",
        url: "/dashboard/courses",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Mon abonnement",
        url: "/dashboard/subscription",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
