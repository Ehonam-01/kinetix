"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// SSR: no way to know the client's preference yet, so assume motion is
// fine — matches what a first paint would show before hydration anyway.
function getReducedMotionServerSnapshot() {
  return false;
}

// One of the few animated pieces on this page (the brief explicitly warns
// against over-animating) — brings a section up out of a slight blur the
// first time it crosses into view. useSyncExternalStore (not a bare
// useEffect+useState "mounted" check) is what keeps this SSR-safe and
// avoids the classic
// set-state-in-effect footgun for reading prefers-reduced-motion.
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const ref = useRef<HTMLDivElement>(null);
  const [intersected, setIntersected] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersected(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  const visible = prefersReducedMotion || intersected;

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,translate,scale,filter] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        // Comes up out of a slight blur and shrink. Once in, filter-none
        // (not blur-0): any filter would make the block the containing box
        // of fixed-position descendants.
        visible
          ? "translate-y-0 scale-100 opacity-100 filter-none"
          : "translate-y-7 scale-[0.96] opacity-0 blur-[6px]",
        className,
      )}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
