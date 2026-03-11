const express = require('express');
const mongoose = require('mongoose');
const { Readable } = require('stream');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const { extractMetadata } = require('../utils/extractGPS');
const { compressImage } = require('../utils/compress');
const { checkStorageLimit } = require('../utils/storage');
const Photo = require('../models/Photo');

const router = express.Router();

let bucket;
function getBucket() {
  if (!bucket) {
    bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: process.env.GRIDFS_BUCKET_NAME || 'photos',
    });
  }
  return bucket;
}

async function storeBuffer(buffer, filename, contentType, metadata = {}) {
  return new Promise((resolve, reject) => {
    const b = getBucket();
    const uploadStream = b.openUploadStream(filename, { contentType, metadata });
    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.on('error', reject);
  });
}

const PHOTO_TYPES = new Set([
  'image/jpeg','image/jpg','image/png','image/heic','image/heif','image/webp','image/tiff',
  'video/mp4','video/quicktime','video/x-msvideo','video/webm',
]);
const AUDIO_TYPES = new Set([
  'audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/flac','audio/aac','audio/x-m4a','audio/mp4',
]);
const MAX_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_r, f, cb) => {
    if (PHOTO_TYPES.has(f.mimetype)) return cb(null, true);
    cb(new Error('Unsupported file type: ' + f.mimetype));
  },
});
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_r, f, cb) => {
    if (AUDIO_TYPES.has(f.mimetype)) return cb(null, true);
    cb(new Error('Not audio: ' + f.mimetype));
  },
});

function emit(req, event, data) {
  try { req.app.get('io')?.emit(event, data); } catch {}
}

function pinFromPhoto(photo, lat, lng) {
  return { id: photo._id, lat, lng, locationSource: photo.locationSource, locationLabel: photo.locationLabel, mediaType: photo.mediaType, title: photo.title, dateTaken: photo.exif?.dateTaken, createdAt: photo.createdAt };
}

// POST /api/photos/upload  –  accepts a SINGLE file under field name "file"
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (err) {
      console.error('❌ Multer error:', err.message, err.code);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    const file = req.file;
    console.log('📥 Upload:', file.originalname, file.mimetype, (file.size / 1024).toFixed(0) + 'KB');

    // Storage limit check
    const { allowed, storage } = await checkStorageLimit(file.size);
    if (!allowed) {
      return res.status(413).json({
        error: `Storage limit reached (${storage.usedMB} / ${storage.maxMB} MB). Free up space.`,
        storage,
      });
    }

    const isVideo = file.mimetype.startsWith('video/');

    // Extract EXIF before compression (compression may strip it)
    const { gps, exif } = isVideo ? { gps: null, exif: {} } : await extractMetadata(file.buffer);

    // Compress images
    const { buffer: compressedBuf, mimeType: compressedMime } = await compressImage(file.buffer, file.mimetype);
    const savedBytes = file.size - compressedBuf.length;
    if (savedBytes > 0) {
      console.log(`🗜️  ${file.originalname}: ${(file.size / 1024).toFixed(0)}KB → ${(compressedBuf.length / 1024).toFixed(0)}KB (saved ${(savedBytes / 1024).toFixed(0)}KB)`);
    }

    const gridfsId = await storeBuffer(compressedBuf, file.originalname, compressedMime, { uploadedAt: new Date() });
    const locationData = gps ? { type: 'Point', coordinates: [gps.lng, gps.lat] } : undefined;
    const photo = await Photo.create({
      filename: Date.now() + '_' + file.originalname,
      originalName: file.originalname,
      mimeType: compressedMime,
      size: compressedBuf.length,
      gridfsId,
      mediaType: isVideo ? 'video' : 'photo',
      location: locationData,
      locationSource: gps ? 'exif' : 'none',
      exif: { ...exif, ...(gps?.altitude ? { altitude: gps.altitude } : {}) },
    });
    const lat = gps?.lat ?? null, lng = gps?.lng ?? null;
    emit(req, 'photo:added', { photo: { ...photo.toJSON(), lat, lng }, pin: gps ? pinFromPhoto(photo, lat, lng) : null });

    console.log('✅ Saved:', photo._id, file.originalname);
    res.status(201).json({
      id: photo._id,
      originalName: photo.originalName,
      mediaType: photo.mediaType,
      hasLocation: !!gps,
      locationSource: photo.locationSource,
      lat, lng,
      exif: photo.exif,
      compressedSize: compressedBuf.length,
      originalSize: file.size,
    });
  } catch (err) {
    console.error('❌ Upload processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/photos
router.get('/', async (req, res) => {
  try {
    const { withLocation, mediaType, tags, categories, page = 1, limit = 200 } = req.query;
    const filter = {};
    if (withLocation === 'true')  filter.locationSource = { $ne: 'none' };
    if (withLocation === 'false') filter.locationSource = 'none';
    if (mediaType) filter.mediaType = mediaType;
    if (tags) { const t = tags.split(',').map(s => s.trim().toLowerCase()).filter(Boolean); if (t.length) filter.tags = { $in: t }; }
    if (categories) { const c = categories.split(',').map(s => s.trim().toLowerCase()).filter(Boolean); if (c.length) filter.categories = { $in: c }; }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [photos, total] = await Promise.all([
      Photo.find(filter).select('-gridfsId -thumbnailId -__v').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Photo.countDocuments(filter),
    ]);
    res.json({ photos, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/photos/categories – all distinct category names
router.get('/categories', async (req, res) => {
  try {
    const cats = await Photo.distinct('categories');
    res.json({ categories: cats.sort() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/photos/map  – grouped pins (one per unique location)
router.get('/map', async (req, res) => {
  try {
    const photos = await Photo.find({ locationSource: { $ne: 'none' } })
      .select('location locationSource locationLabel mediaType title exif.dateTaken createdAt songs')
      .lean();

    // Group photos by rounded coordinates (5 decimals ≈ 1.1 m precision)
    const groups = {};
    for (const p of photos) {
      const lat = Math.round(p.location.coordinates[1] * 1e5) / 1e5;
      const lng = Math.round(p.location.coordinates[0] * 1e5) / 1e5;
      const key = `${lat},${lng}`;
      if (!groups[key]) {
        groups[key] = {
          lat, lng,
          label: p.locationLabel || null,
          locationSource: p.locationSource,
          photos: [],
          songCount: 0,
        };
      }
      groups[key].photos.push(p._id);
      groups[key].songCount += (p.songs?.length || 0);
      if (!groups[key].label && p.locationLabel) groups[key].label = p.locationLabel;
    }

    const pins = Object.entries(groups).map(([key, g]) => ({
      id: key,
      lat: g.lat,
      lng: g.lng,
      label: g.label,
      locationSource: g.locationSource,
      photoCount: g.photos.length,
      songCount: g.songCount,
      photoIds: g.photos,
      thumbnail: g.photos[0],
    }));

    res.json({ pins });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/photos/by-location?lat=X&lng=Y  – all photos at a grouped location
router.get('/by-location', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required.' });
    const rLat = Math.round(parseFloat(lat) * 1e5) / 1e5;
    const rLng = Math.round(parseFloat(lng) * 1e5) / 1e5;

    const photos = await Photo.find({ locationSource: { $ne: 'none' } })
      .select('-gridfsId -thumbnailId -__v')
      .sort({ createdAt: -1 })
      .lean();

    const matching = photos.filter(p => {
      const pLat = Math.round(p.location.coordinates[1] * 1e5) / 1e5;
      const pLng = Math.round(p.location.coordinates[0] * 1e5) / 1e5;
      return pLat === rLat && pLng === rLng;
    });

    const result = matching.map(p => ({
      ...p,
      lat: p.location?.coordinates?.[1] ?? null,
      lng: p.location?.coordinates?.[0] ?? null,
      songs: (p.songs || []).map(s => ({
        _id: s._id, originalName: s.originalName,
        mimeType: s.mimeType, size: s.size, addedAt: s.addedAt,
      })),
    }));

    res.json({ photos: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/photos/:id
router.get('/:id', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id).select('-__v -gridfsId -thumbnailId').lean();
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    // Strip song gridfsIds from response
    const p = { ...photo, lat: photo.location?.coordinates?.[1] ?? null, lng: photo.location?.coordinates?.[0] ?? null };
    if (p.songs) p.songs = p.songs.map(s => ({ _id: s._id, originalName: s.originalName, mimeType: s.mimeType, size: s.size, addedAt: s.addedAt }));
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/photos/:id/file
router.get('/:id/file', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id).select('gridfsId mimeType originalName').lean();
    if (!photo?.gridfsId) return res.status(404).json({ error: 'File not found.' });
    const b = getBucket();
    const fileId = new mongoose.Types.ObjectId(photo.gridfsId);
    const files = await b.find({ _id: fileId }).toArray();
    if (!files.length) return res.status(404).json({ error: 'File missing from storage.' });
    res.set('Content-Type', photo.mimeType);
    res.set('Content-Disposition', 'inline; filename="' + encodeURIComponent(photo.originalName) + '"');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Accept-Ranges', 'bytes');
    const { range } = req.headers;
    if (range && files[0].length) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : files[0].length - 1;
      res.set('Content-Range', 'bytes ' + start + '-' + end + '/' + files[0].length);
      res.set('Content-Length', end - start + 1);
      res.status(206);
      b.openDownloadStream(fileId, { start, end: end + 1 }).pipe(res);
    } else {
      b.openDownloadStream(fileId).on('error', e => res.status(500).json({ error: e.message })).pipe(res);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/photos/:id/location
router.patch('/:id/location', async (req, res) => {
  try {
    const { lat, lng, label } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ error: 'lat and lng required as numbers.' });
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: 'Invalid coordinates.' });
    const upd = { location: { type: 'Point', coordinates: [lng, lat] }, locationSource: 'manual' };
    if (label !== undefined) upd.locationLabel = label;
    const photo = await Photo.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true }).select('-gridfsId -thumbnailId -__v');
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    const pin = pinFromPhoto(photo, lat, lng);
    emit(req, 'photo:updated', { photo: { ...photo.toJSON(), lat, lng }, pin });
    res.json(photo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/photos/:id
router.patch('/:id', async (req, res) => {
  try {
    const { title, description, tags, categories, locationLabel } = req.body;
    const update = {};
    if (title !== undefined)         update.title = title;
    if (description !== undefined)   update.description = description;
    if (Array.isArray(tags))         update.tags = tags.map(t => t.trim().toLowerCase());
    if (categories !== undefined) {
      update.categories = Array.isArray(categories)
        ? [...new Set(categories.map(c => String(c).trim().toLowerCase()).filter(Boolean))]
        : [];
    }
    if (locationLabel !== undefined) update.locationLabel = locationLabel;
    const photo = await Photo.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-gridfsId -thumbnailId -__v');
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    const lat = photo.location?.coordinates?.[1] ?? null, lng = photo.location?.coordinates?.[0] ?? null;
    emit(req, 'photo:updated', { photo: { ...photo.toJSON(), lat, lng }, pin: photo.locationSource !== 'none' ? pinFromPhoto(photo, lat, lng) : null });
    res.json(photo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/photos/:id
router.delete('/:id', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    const b = getBucket();
    const del = async id => { try { await b.delete(new mongoose.Types.ObjectId(id)); } catch {} };
    if (photo.gridfsId)    await del(photo.gridfsId);
    if (photo.thumbnailId) await del(photo.thumbnailId);
    for (const s of photo.songs || []) { if (s.gridfsId) await del(s.gridfsId); }
    await photo.deleteOne();
    emit(req, 'photo:deleted', { id: req.params.id });
    res.json({ message: 'Deleted successfully.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/photos/:id/songs  – upload audio files
router.post('/:id/songs', uploadAudio.array('songs', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No audio files.' });
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    for (const file of req.files) {
      const gridfsId = await storeBuffer(file.buffer, file.originalname, file.mimetype, { photoId: photo._id });
      photo.songs.push({ originalName: file.originalname, mimeType: file.mimetype, size: file.size, gridfsId });
    }
    await photo.save();
    const songs = photo.songs.map(s => ({ _id: s._id, originalName: s.originalName, mimeType: s.mimeType, size: s.size, addedAt: s.addedAt }));
    emit(req, 'photo:updated', { photo: { _id: photo._id, songs } });
    res.json({ songs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/photos/:id/songs/:songId/file – stream audio
router.get('/:id/songs/:songId/file', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id).select('songs').lean();
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    const song = photo.songs.find(s => s._id.toString() === req.params.songId);
    if (!song?.gridfsId) return res.status(404).json({ error: 'Song not found.' });
    const b = getBucket();
    const fileId = new mongoose.Types.ObjectId(song.gridfsId);
    const files = await b.find({ _id: fileId }).toArray();
    if (!files.length) return res.status(404).json({ error: 'Audio file missing.' });
    res.set('Content-Type', song.mimeType || 'audio/mpeg');
    res.set('Content-Disposition', 'inline; filename="' + encodeURIComponent(song.originalName) + '"');
    res.set('Accept-Ranges', 'bytes');
    const { range } = req.headers;
    if (range && files[0].length) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : files[0].length - 1;
      res.set('Content-Range', 'bytes ' + start + '-' + end + '/' + files[0].length);
      res.set('Content-Length', end - start + 1);
      res.status(206);
      b.openDownloadStream(fileId, { start, end: end + 1 }).pipe(res);
    } else {
      res.set('Content-Length', files[0].length);
      b.openDownloadStream(fileId).on('error', e => res.status(500).json({ error: e.message })).pipe(res);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/photos/:id/songs/:songId
router.delete('/:id/songs/:songId', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });
    const idx = photo.songs.findIndex(s => s._id.toString() === req.params.songId);
    if (idx === -1) return res.status(404).json({ error: 'Song not found.' });
    const song = photo.songs[idx];
    if (song.gridfsId) { try { await getBucket().delete(new mongoose.Types.ObjectId(song.gridfsId)); } catch {} }
    photo.songs.splice(idx, 1);
    await photo.save();
    emit(req, 'photo:updated', { photo: { _id: photo._id, songs: photo.songs.map(s => ({ _id: s._id, originalName: s.originalName, mimeType: s.mimeType, size: s.size })) } });
    res.json({ message: 'Song deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
