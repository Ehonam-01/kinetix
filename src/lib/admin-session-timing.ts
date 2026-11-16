// How long an admin session lasts without activity (explicit user
// decision), apart from lib/admin-session.ts so the admin's pages can read
// it without its signing code.
export const ADMIN_IDLE_MS = 60 * 60 * 1000;
