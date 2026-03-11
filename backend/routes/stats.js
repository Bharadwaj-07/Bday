const express = require('express');
const Photo = require('../models/Photo');
const { getStorageUsage } = require('../utils/storage');
const router = express.Router();

// GET /api/stats – aggregated map statistics
router.get('/', async (req, res) => {
  try {
    const [totals, byType, bySource, recentUploads] = await Promise.all([
      Photo.aggregate([
        {
          $group: {
            _id: null,
            total:       { $sum: 1 },
            withGPS:     { $sum: { $cond: [{ $ne: ['$locationSource', 'none'] }, 1, 0] } },
            manualPins:  { $sum: { $cond: [{ $eq: ['$locationSource', 'manual'] }, 1, 0] } },
            exifPins:    { $sum: { $cond: [{ $eq: ['$locationSource', 'exif'] }, 1, 0] } },
            totalSizeGB: { $sum: { $divide: ['$size', 1073741824] } },
          },
        },
      ]),
      Photo.aggregate([
        { $group: { _id: '$mediaType', count: { $sum: 1 } } },
      ]),
      Photo.aggregate([
        { $group: { _id: '$locationSource', count: { $sum: 1 } } },
      ]),
      Photo.find()
        .select('originalName mediaType locationSource createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const storage = await getStorageUsage();

    res.json({
      totals: totals[0] || { total: 0, withGPS: 0, manualPins: 0, exifPins: 0, totalSizeGB: 0 },
      byType: Object.fromEntries(byType.map(d => [d._id, d.count])),
      bySource: Object.fromEntries(bySource.map(d => [d._id, d.count])),
      recentUploads,
      storage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
