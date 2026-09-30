import path from "node:path";
import type { NextConfig } from "next";

// Baseline security headers on every route (security audit M1). The CSP
// here only covers directives that can't break anything the app loads —
// framing (clickjacking on transfer/withdrawal/admin pages), <base> and
// plugins. A full script-src/style-src policy needs nonces (the inline
// theme script in app/layout.tsx) and should be rolled out as
// Content-Security-Policy-Report-Only first.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    // No includeSubDomains/preload: those commit every subdomain of the
    // production domain to HTTPS, which is a decision for whoever owns the
    // DNS zone, not this app.
    value: "max-age=63072000",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker (public/sw.js) must never be served from a cache,
      // or a fix to it wouldn't reach installed apps (Next.js PWA guide).
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  turbopack: {
    root: path.join(__dirname),
  },
  // Dev-only: lets this machine's LAN IP load HMR/CSS/JS dev resources —
  // without it, Next.js blocks cross-origin dev requests by default and the
  // page renders as bare, unstyled HTML when opened from another device
  // (e.g. http://192.168.1.69:3000 instead of http://localhost:3000).
  allowedDevOrigins: ["192.168.1.69"],
};

export default nextConfig;
