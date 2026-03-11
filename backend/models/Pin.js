const mongoose = require('mongoose');

const pinSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  color:       { type: String, default: '#6366f1' },
  lat:         { type: Number, required: true },
  lng:         { type: Number, required: true },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  categories: [{ type: String, trim: true, lowercase: true, maxlength: 50 }],
  photoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo' }],
  musicIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Music' }],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

pinSchema.index({ location: '2dsphere' });
pinSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Pin', pinSchema);
