import { describe, expect, it } from "vitest";
import { parseExifDate, readExif } from "./exif";

describe("parseExifDate", () => {
  it("parses the camera format", () => {
    expect(parseExifDate("2026:09:08 18:30:15")?.getFullYear()).toBe(2026);
    expect(parseExifDate("2026:09:08 18:30:15")?.getHours()).toBe(18);
  });
  it("rejects junk and the 0000 placeholder", () => {
    expect(parseExifDate("0000:00:00 00:00:00")).toBeNull();
    expect(parseExifDate("yesterday")).toBeNull();
    expect(parseExifDate(null)).toBeNull();
  });
});

describe("readExif", () => {
  it("returns nulls for non-JPEG or EXIF-less input", () => {
    expect(readExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toEqual({ takenAt: null, orientation: null });
    expect(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toEqual({ takenAt: null, orientation: null });
  });
  it("reads DateTimeOriginal and orientation from a minimal APP1", () => {
    // Build: SOI, APP1(len), "Exif\0\0", TIFF LE header, IFD0 with orientation=6 and ExifIFD pointer, ExifIFD with 0x9003.
    const bytes: number[] = [];
    const u16 = (n: number) => bytes.push(n & 0xff, (n >> 8) & 0xff);
    const u32 = (n: number) => bytes.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
    bytes.push(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00); // SOI, APP1, len placeholder, "Exif\0\0"
    const tiffStart = bytes.length;
    bytes.push(0x49, 0x49); u16(42); u32(8); // "II", 42, IFD0 at 8
    // IFD0: 2 entries
    u16(2);
    u16(0x0112); u16(3); u32(1); u16(6); u16(0); // orientation = 6
    u16(0x8769); u16(4); u32(1); u32(8 + 2 + 24 + 4); // ExifIFD offset (after IFD0 + next-IFD pointer)
    u32(0); // next IFD
    // ExifIFD: 1 entry, DateTimeOriginal ASCII (20 bytes) stored after the IFD
    const exifIfd = bytes.length - tiffStart;
    u16(1);
    const dateOff = exifIfd + 2 + 12 + 4;
    u16(0x9003); u16(2); u32(20); u32(dateOff);
    u32(0);
    for (const ch of "2026:09:08 18:30:15\0") bytes.push(ch.charCodeAt(0));
    const len = bytes.length - 4; bytes[4] = (len >> 8) & 0xff; bytes[5] = len & 0xff;
    const r = readExif(new Uint8Array(bytes).buffer);
    expect(r.orientation).toBe(6);
    expect([r.takenAt?.getFullYear(), r.takenAt?.getMonth(), r.takenAt?.getDate(), r.takenAt?.getHours()]).toEqual([2026, 8, 8, 18]);
  });
});
