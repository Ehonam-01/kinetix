// Turns a stored lesson video_url (whatever format the admin pasted in —
// a plain watch page, a share link, an already-embeddable URL) into an
// iframe-embeddable URL. For OTHER, only a Google Drive / Google Docs link
// is embedded; any other host, or an unrecognized/unparseable URL, returns
// null — the caller falls back to a plain "open in new tab" link, since
// there's no safe way to guess an embed format for an unknown provider.
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

  // OTHER: a Google Drive link is the one other host embedded in the page
  // (see getGoogleDriveEmbed); anything else stays a plain link.
  return getGoogleDriveEmbed(url)?.src ?? null;
}

export type GoogleDriveEmbed = {
  src: string;
  // file: a video, PDF or image stored in Drive (Drive's own previewer);
  // document: a Google Doc / Sheet / Slides; folder: a whole folder, shown
  // as a list of its files.
  kind: "file" | "document" | "folder";
};

const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

// Turns a Google Drive / Google Docs share link into its embeddable
// "preview" form. The file (or folder) must be shared as "anyone with the
// link can view", or Drive shows a sign-in page instead of the content.
export function getGoogleDriveEmbed(url: string): GoogleDriveEmbed | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname === "drive.google.com") {
    // /file/d/{id}/view, /file/d/{id}/preview, /file/d/{id}
    const file = parsed.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
    if (file && DRIVE_ID.test(file)) {
      return {
        src: `https://drive.google.com/file/d/${file}/preview`,
        kind: "file",
      };
    }
    // /drive/folders/{id}, /drive/u/0/folders/{id}
    const folder = parsed.pathname.match(/\/folders\/([^/]+)/)?.[1];
    if (folder && DRIVE_ID.test(folder)) {
      return {
        src: `https://drive.google.com/embeddedfolderview?id=${folder}#list`,
        kind: "folder",
      };
    }
    // Older /open?id={id} links: a file most of the time.
    const id = parsed.searchParams.get("id");
    if (
      (parsed.pathname === "/open" || parsed.pathname === "/uc") &&
      id &&
      DRIVE_ID.test(id)
    ) {
      return {
        src: `https://drive.google.com/file/d/${id}/preview`,
        kind: "file",
      };
    }
    return null;
  }

  if (parsed.hostname === "docs.google.com") {
    // /document/d/{id}/edit, /spreadsheets/d/{id}/..., /presentation/d/{id}/...
    const match = parsed.pathname.match(
      /^\/(document|spreadsheets|presentation)\/d\/([^/]+)/,
    );
    if (match && DRIVE_ID.test(match[2])) {
      return {
        src: `https://docs.google.com/${match[1]}/d/${match[2]}/preview`,
        kind: "document",
      };
    }
  }

  return null;
}
