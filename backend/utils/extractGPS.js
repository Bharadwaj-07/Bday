/**
 * extractGPS.js
 * Extracts GPS and EXIF metadata from photo/video buffers using exifr.
 */

let exifr;
try {
  exifr = require('exifr');
} catch {
  console.warn('⚠️  exifr not installed – GPS extraction disabled');
}

/**
 * Parse GPS + common EXIF tags from a Buffer.
 * @param {Buffer} buffer
 * @returns {{ gps: {lat, lng, altitude}|null, exif: object }}
 */
async function extractMetadata(buffer) {
  if (!exifr) return { gps: null, exif: {} };

  try {
    const parsed = await exifr.parse(buffer, {
      tiff: true,
      gps: true,
      exif: true,
      ifd0: true,
      ifd1: false,
      interop: false,
      translateValues: true,
      translateKeys: true,
    });

    if (!parsed) return { gps: null, exif: {} };

    // ── GPS ──────────────────────────────────────────────────────────────────
    let gps = null;
    if (
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number' &&
      isFinite(parsed.latitude) &&
      isFinite(parsed.longitude) &&
      Math.abs(parsed.latitude) <= 90 &&
      Math.abs(parsed.longitude) <= 180
    ) {
      gps = {
        lat: parsed.latitude,
        lng: parsed.longitude,
        altitude: typeof parsed.GPSAltitude === 'number' ? parsed.GPSAltitude : null,
      };
    }

    // ── Common EXIF ──────────────────────────────────────────────────────────
    const exif = {};
    if (parsed.DateTimeOriginal) exif.dateTaken = parsed.DateTimeOriginal;
    if (parsed.Make)             exif.make = String(parsed.Make);
    if (parsed.Model)            exif.model = String(parsed.Model);
    if (typeof parsed.FocalLength === 'number') exif.focalLength = parsed.FocalLength;
    if (typeof parsed.ISO === 'number')         exif.iso = parsed.ISO;
    if (typeof parsed.FNumber === 'number')     exif.aperture = parsed.FNumber;
    if (typeof parsed.ExposureTime === 'number' && parsed.ExposureTime > 0)
      exif.shutterSpeed = `1/${Math.round(1 / parsed.ExposureTime)}`;
    if (typeof parsed.ImageWidth === 'number')  exif.width = parsed.ImageWidth;
    if (typeof parsed.ImageHeight === 'number') exif.height = parsed.ImageHeight;
    // Orientation can be number (1-8) or translated string — always store as number
    if (parsed.Orientation != null) {
      const o = parseInt(parsed.Orientation, 10);
      if (!isNaN(o) && o >= 1 && o <= 8) exif.orientation = o;
    }
    if (gps?.altitude)           exif.altitude = gps.altitude;

    return { gps, exif };
  } catch (err) {
    console.warn('⚠️  EXIF extraction failed:', err.message);
    return { gps: null, exif: {} };
  }
}

module.exports = { extractMetadata };
