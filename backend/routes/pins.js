const express = require('express');
const Pin = require('../models/Pin');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function emit(req, event, data) {
  try { req.app.get('io')?.emit(event, data); } catch {}
}

// GET /api/pins — all pins
router.get('/', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const pins = await Pin.find({ ownerId }).sort({ createdAt: -1 }).lean();
    res.json({ pins });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/pins/categories — all distinct category names
router.get('/categories', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const cats = await Pin.distinct('categories', { ownerId });
    res.json({ categories: cats.sort() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins — create pin
router.post('/', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const { name, description, color, lat, lng, categories } = req.body;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'name, lat, lng required.' });
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ error: 'Invalid coordinates.' });
    }
    const cleanCats = Array.isArray(categories)
      ? [...new Set(categories.map(c => String(c).trim().toLowerCase()).filter(Boolean))]
      : [];
    const pin = await Pin.create({
      ownerId,
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#6366f1',
      lat, lng,
      location: { type: 'Point', coordinates: [lng, lat] },
      categories: cleanCats,
    });
    emit(req, 'pin:added', { pin });
    res.status(201).json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/pins/:id — update pin
router.patch('/:id', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const { name, description, color, lat, lng, categories } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description.trim();
    if (color !== undefined) update.color = color;
    if (categories !== undefined) {
      update.categories = Array.isArray(categories)
        ? [...new Set(categories.map(c => String(c).trim().toLowerCase()).filter(Boolean))]
        : [];
    }
    if (typeof lat === 'number' && typeof lng === 'number') {
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({ error: 'Invalid coordinates.' });
      }
      update.lat = lat;
      update.lng = lng;
      update.location = { type: 'Point', coordinates: [lng, lat] };
    }
    const pin = await Pin.findOneAndUpdate({ _id: req.params.id, ownerId }, update, { new: true, runValidators: true }).lean();
    if (!pin) return res.status(404).json({ error: 'Pin not found or not owned by this user.' });
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/pins/:id
router.delete('/:id', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const pin = await Pin.findOneAndDelete({ _id: req.params.id, ownerId });
    if (!pin) return res.status(404).json({ error: 'Pin not found or not owned by this user.' });
    emit(req, 'pin:deleted', { id: req.params.id });
    res.json({ message: 'Pin deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins/:id/link-photos — link photos to pin
router.post('/:id/link-photos', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const { photoIds } = req.body;
    if (!Array.isArray(photoIds)) return res.status(400).json({ error: 'photoIds array required.' });
    const pin = await Pin.findOne({ _id: req.params.id, ownerId });
    if (!pin) return res.status(404).json({ error: 'Pin not found or not owned by this user.' });
    for (const pid of photoIds) {
      if (!pin.photoIds.some(id => id.toString() === pid)) {
        pin.photoIds.push(pid);
      }
    }
    await pin.save();
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins/:id/unlink-photo
router.post('/:id/unlink-photo', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const { photoId } = req.body;
    const pin = await Pin.findOne({ _id: req.params.id, ownerId });
    if (!pin) return res.status(404).json({ error: 'Pin not found or not owned by this user.' });
    pin.photoIds = pin.photoIds.filter(id => id.toString() !== photoId);
    await pin.save();
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins/:id/link-music
router.post('/:id/link-music', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const { musicIds } = req.body;
    if (!Array.isArray(musicIds)) return res.status(400).json({ error: 'musicIds array required.' });
    const pin = await Pin.findOne({ _id: req.params.id, ownerId });
    if (!pin) return res.status(404).json({ error: 'Pin not found or not owned by this user.' });

    const uniqueMusicIds = [...new Set(musicIds.map(String).filter(Boolean))];
    pin.musicIds = uniqueMusicIds.length ? [uniqueMusicIds[uniqueMusicIds.length - 1]] : [];

    await pin.save();
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins/:id/unlink-music
router.post('/:id/unlink-music', async (req, res) => {
  try {
    const ownerId = req.user.sub;
    const { musicId } = req.body;
    const pin = await Pin.findOne({ _id: req.params.id, ownerId });
    if (!pin) return res.status(404).json({ error: 'Pin not found or not owned by this user.' });
    pin.musicIds = pin.musicIds.filter(id => id.toString() !== musicId);
    await pin.save();
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
