const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// For every member-controlled value interpolated into an email's HTML
// (names, pseudos) — a full name is free text, so without this anyone
// could slip a link or markup into an email sent from the platform's own
// verified domain (security audit M4).
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
