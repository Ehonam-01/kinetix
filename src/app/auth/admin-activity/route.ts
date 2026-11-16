// An admin active on a page without loading anything (reading, filling a
// long form): the admin pages call this now and then
// (app/admin/idle-logout.tsx) so the hour without activity starts again.
// The proxy (src/proxy.ts) moves the session cookie forward, as on any
// request; nothing to do here.
export function GET() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
