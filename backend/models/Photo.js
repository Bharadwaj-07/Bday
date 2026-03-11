const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  type:        { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true }, // [lng, lat]
}, { _id: false });

const photoSchema = new mongoose.Schema({
  // ── File Info ──────────────────────────────────────────────────────────────
  filename:     { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType:     { type: String, required: true },
  size:         { type: Number, required: true },         // bytes
  gridfsId:     { type: mongoose.Schema.Types.ObjectId }, // GridFS file ref
  thumbnailId:  { type: mongoose.Schema.Types.ObjectId }, // GridFS thumbnail ref

  // ── Location ───────────────────────────────────────────────────────────────
  location: locationSchema,    // GeoJSON Point
  locationSource: {
    type: String,
    enum: ['exif', 'manual', 'none'],
    default: 'none',
  },
  locationLabel: { type: String, trim: true }, // reverse-geocoded or user label

  // ── EXIF Metadata ──────────────────────────────────────────────────────────
  exif: {
    dateTaken:   { type: Date },
    make:        { type: String },
    model:       { type: String },
    focalLength: { type: Number },
    iso:        { type: Number },
    aperture:   { type: Number },
    shutterSpeed:{ type: String },
    width:       { type: Number },
    height:      { type: Number },
    orientation: { type: Number },
    altitude:    { type: Number },
  },

  // ── User metadata ─────────────────────────────────────────────────────────
  title:       { type: String, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  tags:        [{ type: String, trim: true, lowercase: true }],
  categories:  [{ type: String, trim: true, lowercase: true, maxlength: 50 }],

  // ── Songs ─────────────────────────────────────────────────────────────────
  songs: [{
    originalName: { type: String, required: true },
    mimeType:     { type: String, default: 'audio/mpeg' },
    size:         { type: Number },
    gridfsId:     { type: mongoose.Schema.Types.ObjectId },
    addedAt:      { type: Date, default: Date.now },
  }],

  // ── Type ───────────────────────────────────────────────────────────────────
  mediaType: { type: String, enum: ['photo', 'video'], default: 'photo' },

  // ── Timestamps ────────────────────────────────────────────────────────────
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Geospatial index for map queries
photoSchema.index({ location: '2dsphere' });
photoSchema.index({ createdAt: -1 });
photoSchema.index({ tags: 1 });
photoSchema.index({ categories: 1 });
photoSchema.index({ locationSource: 1 });

// Virtual: lat/lng shorthand
photoSchema.virtual('lat').get(function () {
  return this.location?.coordinates?.[1] ?? null;
});
photoSchema.virtual('lng').get(function () {
  return this.location?.coordinates?.[0] ?? null;
});

// Virtual: has location
photoSchema.virtual('hasLocation').get(function () {
  return this.locationSource !== 'none' && !!this.location;
});

module.exports = mongoose.model('Photo', photoSchema);
