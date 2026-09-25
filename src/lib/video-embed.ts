// Turns a stored lesson video_url (whatever format the admin pasted in —
// a plain watch page, a share link, an already-embeddable URL) into an
// iframe-embeddable URL. Returns null for OTHER or an unrecognized/
// unparseable URL — the caller falls back to a plain "open in new tab"
// link in that case, since there's no safe way to guess an embed format
// for an unknown provider.
export function getVideoEmbedUrl(
  provider: "YOUTUBE" | "VIMEO" | "OTHER" | null,
  url: string,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (provider === "YOUTUBE") {
    let id: string | null = null;
    if (parsed.hostname === "youtu.be") {
      id = parsed.pathname.slice(1).split("/")[0] || null;
    } else if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") {
        id = parsed.searchParams.get("v");
      } else {
        id = parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? null;
      }
    }
    // rel=0 keeps end-screen/related-video suggestions limited to the same
    // channel — the closest a plain embed gets to not sending a paying
    // member off into someone else's video.
    return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
  }

  if (provider === "VIMEO") {
    if (!parsed.hostname.endsWith("vimeo.com")) return null;
    // A private Vimeo link is /{id}/{hash} — the hash has to be forwarded
    // as ?h= or the embed 403s. A plain public link is just /{id}.
    const [id, hash] = parsed.pathname.split("/").filter(Boolean);
    if (!id || !/^\d+$/.test(id)) return null;
    return hash
      ? `https://player.vimeo.com/video/${id}?h=${hash}`
      : `https://player.vimeo.com/video/${id}`;
  }

  return null;
}
