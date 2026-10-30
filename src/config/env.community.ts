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

// Same for the members' WhatsApp group, set as WHATSAPP_COMMUNITY_URL. The
// app adds a tracking query when the link is copied from a phone: accepted.
const WHATSAPP_INVITE_PATTERN =
  /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+\/?(\?[A-Za-z0-9_=&-]*)?$/;

export function getWhatsappCommunityUrl(): string | null {
  const url = process.env.WHATSAPP_COMMUNITY_URL?.trim();
  return url && WHATSAPP_INVITE_PATTERN.test(url) ? url : null;
}
