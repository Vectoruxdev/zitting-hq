"use client";
/**
 * Prepare a photo on the device before upload: orientation-correct decode,
 * a ≤2048px JPEG plus a square ~400px thumbnail, dimensions, and the EXIF
 * taken-at date (which the re-encode would otherwise drop).
 */
import { resizeImage } from "./image";
import { readExif } from "./exif";

export interface PreparedPhoto { full: Blob; thumb: Blob; width: number; height: number; takenAt: Date | null; name: string }

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const head = await file.slice(0, 256 * 1024).arrayBuffer();
  const exif = readExif(head);
  const [full, thumb] = await Promise.all([resizeImage(file, { max: 2048, quality: 0.82 }), resizeImage(file, { max: 400, quality: 0.8, square: true })]);
  const dims = await blobDims(full);
  return { full, thumb, width: dims.w, height: dims.h, takenAt: exif.takenAt ?? (file.lastModified ? new Date(file.lastModified) : null), name: file.name };
}

async function blobDims(blob: Blob): Promise<{ w: number; h: number }> {
  try { const bmp = await createImageBitmap(blob); const d = { w: bmp.width, h: bmp.height }; bmp.close(); return d; } catch { return { w: 0, h: 0 }; }
}
