// The workshop as a calendar file (RFC 5545). Pure, so its escaping and
// CRLF line endings stay under test.
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildWorkshopIcs(input: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  venue: string;
  url: string;
}) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kinetix Africa//Atelier//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.id}@kinetix-africa`,
    `DTSTAMP:${toIcsDate(input.startsAt)}`,
    `DTSTART:${toIcsDate(input.startsAt)}`,
    `DTEND:${toIcsDate(input.endsAt)}`,
    `SUMMARY:${escapeText(input.title)}`,
    `LOCATION:${escapeText(input.venue)}`,
    `URL:${input.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
