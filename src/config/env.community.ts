import "server-only";

// The members' Discord invite, set in Vercel as DISCORD_INVITE_URL — kept
// out of the code (and of the public GitHub repository) on purpose: it's
// only ever rendered inside the member area (app/dashboard/community),
// after sign-in with a valid subscription. Anything that isn't a Discord
// invite link is ignored rather than shown.
const DISCORD_INVITE_PATTERN =
  /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+\/?$/;

export function getDiscordInviteUrl(): string | null {
  const url = process.env.DISCORD_INVITE_URL?.trim();
  return url && DISCORD_INVITE_PATTERN.test(url) ? url : null;
}
