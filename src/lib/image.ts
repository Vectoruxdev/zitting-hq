"use client";
/**
 * Client-side image prep before upload (avatars now, photos in Phase 3):
 * decode → downscale to `max` on the long edge → JPEG. Keeps uploads small
 * and normalizes HEIC from iOS (the browser decodes it; we re-encode).
 */
export async function resizeImage(file: File, { max = 1024, quality = 0.86, square = false }: { max?: number; quality?: number; square?: boolean } = {}): Promise<Blob> {
  // `from-image` bakes the EXIF orientation into the pixels, so the re-encoded JPEG needs no orientation tag.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file).catch(() => null));
  if (!bitmap) return file;
  let { width: w, height: h } = bitmap;
  let sx = 0, sy = 0, sw = w, sh = h;
  if (square) { const side = Math.min(w, h); sx = (w - side) / 2; sy = (h - side) / 2; sw = sh = side; w = h = side; }
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  return blob || file;
}
