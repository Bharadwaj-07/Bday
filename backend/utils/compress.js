/**
 * compress.js – Image compression with sharp.
 * Videos are NOT re-encoded (would require ffmpeg); they pass through as-is.
 */

const sharp = require('sharp');

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png',
  'image/webp', 'image/tiff', 'image/heic', 'image/heif',
]);

// Max dimension (longest edge) — images larger than this get resized.
const MAX_DIMENSION = 2048;
// JPEG / WebP quality target
const QUALITY = 80;

/**
 * Compress an image buffer. Returns { buffer, mimeType }.
 * If the input is not a supported image, returns the original buffer untouched.
 */
async function compressImage(inputBuffer, mimeType) {
  if (!IMAGE_TYPES.has(mimeType)) {
    // Not an image (e.g. video) — return as-is
    return { buffer: inputBuffer, mimeType };
  }

  try {
    let pipeline = sharp(inputBuffer, { failOn: 'none' }).rotate(); // auto-rotate from EXIF

    const metadata = await sharp(inputBuffer, { failOn: 'none' }).metadata();
    const { width, height } = metadata;

    // Resize if either dimension exceeds MAX_DIMENSION
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      pipeline = pipeline.resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG for best compression (except PNGs with transparency → WebP)
    let outputMime;
    if (mimeType === 'image/png') {
      pipeline = pipeline.webp({ quality: QUALITY });
      outputMime = 'image/webp';
    } else {
      // jpeg for everything else (heic, tiff, jpg, webp → jpeg)
      pipeline = pipeline.jpeg({ quality: QUALITY, mozjpeg: true });
      outputMime = 'image/jpeg';
    }

    const outputBuffer = await pipeline.toBuffer();

    // Only use compressed version if it's actually smaller
    if (outputBuffer.length < inputBuffer.length) {
      return { buffer: outputBuffer, mimeType: outputMime };
    }

    // Compressed is larger (rare, very small images) → keep original
    return { buffer: inputBuffer, mimeType };
  } catch (err) {
    console.warn('⚠️  Compression failed, using original:', err.message);
    return { buffer: inputBuffer, mimeType };
  }
}

module.exports = { compressImage };
