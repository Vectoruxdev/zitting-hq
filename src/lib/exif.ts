/**
 * Tiny EXIF reader: DateTimeOriginal + orientation from a JPEG's APP1 segment.
 * Runs in the browser before upload so `taken_at` survives our re-encode
 * (canvas output has no EXIF). Returns nulls for anything it can't read.
 */
export interface ExifBits { takenAt: Date | null; orientation: number | null }

/** "YYYY:MM:DD HH:MM:SS" → Date (local time, as cameras record it). */
export function parseExifDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  return isNaN(d.getTime()) || Number(m[1]) < 1990 ? null : d;
}

export function readExif(buf: ArrayBuffer): ExifBits {
  const out: ExifBits = { takenAt: null, orientation: null };
  try {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return out; // not a JPEG
    let off = 2;
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off);
      const len = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) { // "Exif"
        const tiff = off + 10;
        const le = v.getUint16(tiff) === 0x4949;
        const u16 = (o: number) => v.getUint16(o, le), u32 = (o: number) => v.getUint32(o, le);
        const ifd0 = tiff + u32(tiff + 4);
        let exifIfd = 0, dateStr: string | null = null;
        const readIfd = (ifd: number, want: Record<number, (valOff: number, count: number, type: number) => void>) => {
          if (ifd <= 0 || ifd + 2 > v.byteLength) return;
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (e + 12 > v.byteLength) break;
            const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
            const size = (type === 3 ? 2 : type === 4 ? 4 : 1) * count;
            const valOff = size > 4 ? tiff + u32(e + 8) : e + 8;
            want[tag]?.(valOff, count, type);
          }
        };
        readIfd(ifd0, { 0x0112: (o) => { out.orientation = u16(o); }, 0x8769: (o) => { exifIfd = tiff + u32(o); }, 0x0132: (o, c) => { dateStr = dateStr || ascii(v, o, c); } });
        if (exifIfd) readIfd(exifIfd, { 0x9003: (o, c) => { dateStr = ascii(v, o, c); }, 0x9004: (o, c) => { dateStr = dateStr || ascii(v, o, c); } });
        out.takenAt = parseExifDate(dateStr);
        return out;
      }
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break; // start of scan / not a marker
      off += 2 + len;
    }
  } catch { /* malformed — nulls */ }
  return out;
}

function ascii(v: DataView, off: number, count: number): string {
  let s = "";
  for (let i = 0; i < Math.min(count, 64) && off + i < v.byteLength; i++) { const c = v.getUint8(off + i); if (!c) break; s += String.fromCharCode(c); }
  return s;
}
