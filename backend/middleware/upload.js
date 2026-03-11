/**
 * upload.js – Multer storage middleware using memory storage.
 * Files are kept in RAM briefly so we can extract EXIF before persisting to GridFS.
 */

const multer = require('multer');

const ALLOWED_TYPES = {
  'image/jpeg': true,
  'image/jpg': true,
  'image/png': true,
  'image/heic': true,
  'image/heif': true,
  'image/webp': true,
  'image/tiff': true,
  'video/mp4': true,
  'video/quicktime': true,
  'video/x-msvideo': true,
  'video/webm': true,
};

const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES, files: 20 },
  fileFilter,
});

module.exports = { upload };
