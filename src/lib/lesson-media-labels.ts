// How a lesson's media source is named in the admin (the stored values
// stay YOUTUBE / VIMEO / OTHER). OTHER covers Google Drive, which the
// lesson player embeds in the page (lib/video-embed.ts); any other link
// is shown as a plain "open" link.
export const VIDEO_PROVIDER_LABEL = {
  YOUTUBE: "YouTube",
  VIMEO: "Vimeo",
  OTHER: "Google Drive / autre lien",
} as const;

export const DRIVE_SHARING_HINT =
  "Collez le lien de partage Google Drive (vidéo, PDF, document ou dossier). Il doit être partagé en « Tous les utilisateurs disposant du lien », en lecture seule.";
