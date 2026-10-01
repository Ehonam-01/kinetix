// Shrinks an image in the browser before it's uploaded through a Server
// Action: those accept at most 4 MB (next.config.ts) — Vercel itself caps
// a request at 4.5 MB — while a phone photo is often 3 to 6 MB. Course
// thumbnails and reward pictures never need more than 1 600 px, and a
// smaller file also makes the public pages load faster.
//
// An image already light and small enough is sent untouched (a PNG keeps
// its transparency). Anything else is redrawn at most MAX_SIDE px on its
// longest side, as a JPEG on a white background.
const MAX_SIDE = 1600;
const KEEP_AS_IS_BYTES = 900 * 1024;
const JPEG_QUALITY = 0.85;

async function loadImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function resizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  let image;
  try {
    image = await loadImage(file);
  } catch {
    // Not decodable here (unusual format): let the server decide.
    return file;
  }

  const longest = Math.max(image.width, image.height);
  if (file.size <= KEEP_AS_IS_BYTES && longest <= MAX_SIDE) return file;

  const ratio = Math.min(1, MAX_SIDE / longest);
  const width = Math.round(image.width * ratio);
  const height = Math.round(image.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image.source, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
