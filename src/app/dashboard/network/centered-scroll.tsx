"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A tree wider than the screen (a phone, deep levels) opens scrolled to its
// middle, with the member at the top in view, instead of on its left edge.
export function CenteredScroll({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node && node.scrollWidth > node.clientWidth) {
      node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2;
    }
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
