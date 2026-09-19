const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true },
  mimeType:     { type: String, default: 'audio/mpeg' },
  size:         { type: Number },
  gridfsId:     { type: mongoose.Schema.Types.ObjectId, required: true },
  duration:     { type: Number },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

musicSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('Music', musicSchema);
