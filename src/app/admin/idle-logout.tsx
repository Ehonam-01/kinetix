"use client";

import { useEffect } from "react";
import { ADMIN_IDLE_MS } from "@/lib/admin-session-timing";

// Shared by the admin's tabs: activity in one keeps the others open.
const STORAGE_KEY = "kx_admin_activity";
// Activity without a request is reported at most this often.
const REPORT_EVERY_MS = 5 * 60 * 1000;

function readShared() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeShared(at: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Storage blocked: this tab counts on its own.
  }
}

// An hour without touching the admin (explicit user decision): the page
// goes to the sign-out itself, rather than waiting for the next click to
// find the session over. Activity that loads nothing (reading, typing) is
// reported to the server now and then, so the server's own count
// (lib/admin-session.ts) doesn't end a session still in use.
export function AdminIdleLogout() {
  useEffect(() => {
    let last = Date.now();
    let reported = last;
    writeShared(last);

    const onActivity = () => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      writeShared(now);
      if (now - reported >= REPORT_EVERY_MS) {
        reported = now;
        fetch("/auth/admin-activity", { cache: "no-store" }).catch(() => {});
      }
    };
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "wheel"];
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true });
    }

    const check = window.setInterval(() => {
      const latest = Math.max(last, readShared());
      if (Date.now() - latest >= ADMIN_IDLE_MS) {
        // A full page load on purpose: a route handler signs out and
        // writes the cookies, which the client router can't follow.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/auth/admin-expired";
      }
    }, 30_000);

    return () => {
      for (const name of events) window.removeEventListener(name, onActivity);
      window.clearInterval(check);
    };
  }, []);

  return null;
}
