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
