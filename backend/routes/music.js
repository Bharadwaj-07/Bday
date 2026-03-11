const express = require('express');
const mongoose = require('mongoose');
const { Readable } = require('stream');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const Music = require('../models/Music');
const { checkStorageLimit } = require('../utils/storage');

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

const AUDIO_TYPES = new Set([
  'audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/flac','audio/aac','audio/x-m4a','audio/mp4',
]);
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => AUDIO_TYPES.has(f.mimetype) ? cb(null, true) : cb(new Error('Not audio: ' + f.mimetype)),
});

function emit(req, event, data) {
  try { req.app.get('io')?.emit(event, data); } catch {}
}

// GET /api/music — all music
router.get('/', async (req, res) => {
  try {
    const music = await Music.find().sort({ createdAt: -1 }).lean();
    res.json({ music });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/music/upload — upload a single music file
router.post('/upload', (req, res, next) => {
  uploadAudio.single('file')(req, res, err => {
    if (err) {
      console.error('❌ Music multer error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided.' });

    const file = req.file;
    console.log('🎵 Upload:', file.originalname, file.mimetype, (file.size / 1024).toFixed(0) + 'KB');

    const { allowed, storage } = await checkStorageLimit(file.size);
    if (!allowed) {
      return res.status(413).json({
        error: `Storage limit reached (${storage.usedMB} / ${storage.maxMB} MB). Free up space.`,
        storage,
      });
    }

    const gridfsId = await storeBuffer(file.buffer, file.originalname, file.mimetype, { uploadedAt: new Date() });
    const music = await Music.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      gridfsId,
    });
    emit(req, 'music:added', { music });

    console.log('✅ Music saved:', music._id, file.originalname);
    res.status(201).json({ _id: music._id, originalName: music.originalName, size: music.size });
  } catch (err) {
    console.error('❌ Music upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/music/:id/file — stream audio
router.get('/:id/file', async (req, res) => {
  try {
    const music = await Music.findById(req.params.id).lean();
    if (!music?.gridfsId) return res.status(404).json({ error: 'Music not found.' });
    const b = getBucket();
    const fileId = new mongoose.Types.ObjectId(music.gridfsId);
    const files = await b.find({ _id: fileId }).toArray();
    if (!files.length) return res.status(404).json({ error: 'Audio file missing.' });
    res.set('Content-Type', music.mimeType || 'audio/mpeg');
    res.set('Content-Disposition', 'inline; filename="' + encodeURIComponent(music.originalName) + '"');
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
      if (files[0].length) res.set('Content-Length', files[0].length);
      b.openDownloadStream(fileId).on('error', e => res.status(500).json({ error: e.message })).pipe(res);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/music/:id
router.delete('/:id', async (req, res) => {
  try {
    const music = await Music.findById(req.params.id);
    if (!music) return res.status(404).json({ error: 'Music not found.' });
    if (music.gridfsId) {
      try { await getBucket().delete(new mongoose.Types.ObjectId(music.gridfsId)); } catch {}
    }
    await music.deleteOne();
    emit(req, 'music:deleted', { id: req.params.id });
    res.json({ message: 'Music deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
