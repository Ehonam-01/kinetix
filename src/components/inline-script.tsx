// Next.js's documented pattern for a script that must run before hydration
// (node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md)
// without React 19 warning "Encountered a script tag while rendering React
// component": type is "text/javascript" on the server (the browser's HTML
// parser executes it immediately, before React loads) and "text/plain" on
// the client (so if this component ever re-renders, React sees an inert
// tag, not a live script it "created"). suppressHydrationWarning covers the
// type mismatch itself.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
