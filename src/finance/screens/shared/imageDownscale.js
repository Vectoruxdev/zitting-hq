/* Downscale a receipt photo in the browser before upload. Phone cameras
   produce 3–12MB images; the scanner only needs ~2000px to read every line
   item, and Claude's vision API caps images at 5MB. Returns a JPEG File
   (~0.3–1MB) — or the ORIGINAL file untouched if anything about decoding
   fails, so upload always proceeds. */
export async function downscaleReceiptPhoto(file, maxDim = 2000, quality = 0.85) {
  try {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    // Already small and within scanner-friendly bounds — send as-is.
    if (file.size < 900 * 1024) return file;
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || !blob.size) return file;
    const name = (file.name || 'receipt').replace(/\.[a-z0-9]+$/i, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file; // odd format (e.g. HEIC the browser can't decode) — upload the original
  }
}
