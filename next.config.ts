import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
