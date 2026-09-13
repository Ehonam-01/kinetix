import Image from "next/image";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/config/site";

// The real brand mark (public/logo-horizontal.png) — replaces the
// placeholder icon-square + text pairing used everywhere before it existed.
export function Logo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-horizontal.png"
      alt={SITE_NAME}
      width={413}
      height={217}
      priority={priority}
      className={cn("h-9 w-auto", className)}
    />
  );
}
