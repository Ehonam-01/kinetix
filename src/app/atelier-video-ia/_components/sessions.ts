// The sessions of the workshop as the page and its form show them: one per
// city, each with its own date, place, price and seats (explicit user
// decision). Plain data, built on the server, passed to the browser.

export type LiveSession = {
  id: string;
  city: string;
  // "Samedi 28 novembre · 8 h – 12 h", in Lomé time.
  when: string;
  // The address, or the city until the address is set.
  place: string;
  price: number;
  regularPrice: number;
  remaining: number;
  open: boolean;
  startsAt: string;
};

const fmtDay = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lome",
  });

export function fmtHour(date: Date) {
  const [hours, minutes] = date
    .toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Lome",
    })
    .split(":");
  return `${Number(hours)} h${minutes === "00" ? "" : ` ${minutes}`}`;
}

export const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

export function sessionDay(startsAt: Date | string) {
  return fmtDay(new Date(startsAt));
}

export function toLiveSession({
  session,
  remaining,
  open,
}: {
  session: {
    id: string;
    city: string | null;
    venue: string;
    priceCfa: number;
    regularPriceCfa: number;
    startsAt: Date;
    endsAt: Date;
  };
  remaining: number;
  open: boolean;
}): LiveSession {
  return {
    id: session.id,
    city: session.city ?? "",
    when: `${capitalize(fmtDay(session.startsAt))} · ${fmtHour(session.startsAt)} – ${fmtHour(session.endsAt)}`,
    place: session.venue.trim() || session.city || "",
    price: session.priceCfa,
    regularPrice: session.regularPriceCfa,
    remaining,
    open,
    startsAt: session.startsAt.toISOString(),
  };
}

// "Lomé, Kara ou Notsé".
export function citiesLabel(sessions: { city: string }[], last = "ou") {
  const cities = sessions.map((s) => s.city).filter(Boolean);
  if (cities.length <= 1) return cities[0] ?? "";
  return `${cities.slice(0, -1).join(", ")} ${last} ${cities.at(-1)}`;
}

// The price to announce: the same everywhere, or the lowest ("dès").
export function priceSummary(sessions: { price: number }[]) {
  const prices = sessions.map((s) => s.price);
  if (prices.length === 0) return { price: 0, from: false };
  const price = Math.min(...prices);
  return { price, from: prices.some((p) => p !== price) };
}
