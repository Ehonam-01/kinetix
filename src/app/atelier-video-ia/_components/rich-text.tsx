// The page's only markup: **bold**, as the supplied text writes it.
export function RichText({ text }: { text: string }) {
  return text
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>,
    );
}
