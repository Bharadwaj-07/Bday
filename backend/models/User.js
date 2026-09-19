const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  picture: {
    type: String,
    default: '',
  },
  googleId: {
    type: String,
    default: null,
    sparse: true,
    unique: true,
  },
  authStatus: {
    type: String,
    enum: ['provisional', 'verified'],
    default: 'provisional',
  },
  emailVerified: {
    type: Boolean,
    default: true,
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  loginCount: {
    type: Number,
    default: 0,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
