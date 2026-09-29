import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Same lowercase/dash rule as migration 0022's SQL backfill, plus an accent
// fold migration 0022 didn't have: NFD-normalizing before stripping
// non-alphanumerics turns "é"/"î"/"ô" into their plain-letter form first
// (générative -> generative) instead of just deleting the accented letter
// outright (générative -> g-n-rative) — found while seeding real French
// course titles, where every other word has a diacritic.
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "45 min", "2 h", "3 h 20" — a course's duration as learners and visitors
// see it.
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
