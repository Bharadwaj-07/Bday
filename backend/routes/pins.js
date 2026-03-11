const express = require('express');
const Pin = require('../models/Pin');

const router = express.Router();

function emit(req, event, data) {
  try { req.app.get('io')?.emit(event, data); } catch {}
}

// GET /api/pins — all pins
router.get('/', async (req, res) => {
  try {
    const pins = await Pin.find().sort({ createdAt: -1 }).lean();
    res.json({ pins });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/pins/categories — all distinct category names
router.get('/categories', async (req, res) => {
  try {
    const cats = await Pin.distinct('categories');
    res.json({ categories: cats.sort() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins — create pin
router.post('/', async (req, res) => {
  try {
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
    const pin = await Pin.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).lean();
    if (!pin) return res.status(404).json({ error: 'Pin not found.' });
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/pins/:id
router.delete('/:id', async (req, res) => {
  try {
    const pin = await Pin.findByIdAndDelete(req.params.id);
    if (!pin) return res.status(404).json({ error: 'Pin not found.' });
    emit(req, 'pin:deleted', { id: req.params.id });
    res.json({ message: 'Pin deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins/:id/link-photos — link photos to pin
router.post('/:id/link-photos', async (req, res) => {
  try {
    const { photoIds } = req.body;
    if (!Array.isArray(photoIds)) return res.status(400).json({ error: 'photoIds array required.' });
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ error: 'Pin not found.' });
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
    const { photoId } = req.body;
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ error: 'Pin not found.' });
    pin.photoIds = pin.photoIds.filter(id => id.toString() !== photoId);
    await pin.save();
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins/:id/link-music
router.post('/:id/link-music', async (req, res) => {
  try {
    const { musicIds } = req.body;
    if (!Array.isArray(musicIds)) return res.status(400).json({ error: 'musicIds array required.' });
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ error: 'Pin not found.' });
    for (const mid of musicIds) {
      if (!pin.musicIds.some(id => id.toString() === mid)) {
        pin.musicIds.push(mid);
      }
    }
    await pin.save();
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pins/:id/unlink-music
router.post('/:id/unlink-music', async (req, res) => {
  try {
    const { musicId } = req.body;
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ error: 'Pin not found.' });
    pin.musicIds = pin.musicIds.filter(id => id.toString() !== musicId);
    await pin.save();
    emit(req, 'pin:updated', { pin });
    res.json(pin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
