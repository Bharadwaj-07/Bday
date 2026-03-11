/**
 * storage.js – Track total GridFS storage and enforce a cap.
 */

const mongoose = require('mongoose');
const Photo = require('../models/Photo');
const Music = require('../models/Music');

const MAX_STORAGE_BYTES = (parseInt(process.env.MAX_STORAGE_MB) || 500) * 1024 * 1024;

/**
 * Returns { usedBytes, maxBytes, usedMB, maxMB, percent, remaining }.
 */
async function getStorageUsage() {
  const [photoAgg, musicAgg] = await Promise.all([
    Photo.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]),
    Music.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]),
  ]);

  const usedBytes = (photoAgg[0]?.total || 0) + (musicAgg[0]?.total || 0);
  const maxBytes = MAX_STORAGE_BYTES;

  return {
    usedBytes,
    maxBytes,
    usedMB: +(usedBytes / (1024 * 1024)).toFixed(2),
    maxMB: +(maxBytes / (1024 * 1024)).toFixed(0),
    percent: +(usedBytes / maxBytes * 100).toFixed(1),
    remaining: maxBytes - usedBytes,
  };
}

/**
 * Check whether adding `additionalBytes` would exceed the cap.
 * Returns { allowed, storage }.
 */
async function checkStorageLimit(additionalBytes = 0) {
  const storage = await getStorageUsage();
  return {
    allowed: (storage.usedBytes + additionalBytes) <= storage.maxBytes,
    storage,
  };
}

module.exports = { getStorageUsage, checkStorageLimit, MAX_STORAGE_BYTES };
