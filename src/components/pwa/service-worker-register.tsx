"use client";

import { useEffect } from "react";

// Registers public/sw.js (offline page only — see that file). Production
// only: in `next dev` a service worker would get in the way of hot reload.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Not fatal: the site works exactly the same without it.
      });
  }, []);
  return null;
}
