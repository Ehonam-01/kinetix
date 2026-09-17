import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Reserves the exact visual space a real photo/screenshot will occupy,
// without inventing one in the meantime (explicit project rule — see
// coming-soon-section.tsx). Checks the filesystem at render time: drop a
// file at public<src> and this section picks it up on the next build/
// revalidation, no code change needed. `placeholder` lets a section that
// already has a tasteful hand-built illustration (e.g. AiMockup) show that
// instead of the generic dashed box while the slot is still empty.
export function MediaSlot({
  src,
  alt,
  brief,
  className,
  imgClassName,
  priority,
  placeholder,
}: {
  src: string;
  alt: string;
  brief: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  placeholder?: ReactNode;
}) {
  const exists = fs.existsSync(path.join(process.cwd(), "public", src));

  if (exists) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className={cn("object-cover", imgClassName)}
        />
      </div>
    );
  }

  if (placeholder) {
    return <div className={cn("relative", className)}>{placeholder}</div>;
  }

  return (
    <div
      className={cn(
        "border-brand-accent/30 bg-brand-accent/5 text-muted-foreground relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center",
        className,
      )}
    >
      <ImageIcon className="text-brand-accent/50 size-8" />
      <p className="max-w-xs text-sm leading-relaxed">{brief}</p>
      <p className="text-muted-foreground/70 font-mono text-xs">
        public{src}
      </p>
    </div>
  );
}
