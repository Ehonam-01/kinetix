import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or redirect-only areas — nothing there for a search engine.
      disallow: ["/dashboard", "/admin", "/api", "/r/", "/mfa", "/auth"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
