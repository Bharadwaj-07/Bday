const mongoose = require('mongoose');

const PUBLIC_OWNER_ID = new mongoose.Types.ObjectId('000000000000000000000000');

function requireAuth(req, res, next) {
  req.user = req.user || {
    sub: PUBLIC_OWNER_ID.toString(),
    email: 'public@local',
    name: 'Public User',
  };
  next();
}

module.exports = { requireAuth };
