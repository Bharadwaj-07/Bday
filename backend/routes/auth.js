const express = require('express');
const axios = require('axios');
const User = require('../models/User');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

async function verifyGoogleToken(token) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const googleRes = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: token },
  });

  const payload = googleRes.data;
  if (!payload || !payload.email) {
    throw new Error('Invalid Google token');
  }

  return payload;
}

router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ error: 'Google idToken is required' });
    }

    const googleUser = await verifyGoogleToken(idToken);
    const email = String(googleUser.email || '').trim().toLowerCase();
    const googleId = googleUser.sub || null;

    if (!email) {
      return res.status(400).json({ error: 'Google email missing' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        name: googleUser.name || '',
        picture: googleUser.picture || '',
        googleId,
        authStatus: 'provisional',
        emailVerified: Boolean(googleUser.email_verified),
        profileCompleted: false,
        loginCount: 1,
        lastLoginAt: new Date(),
      });
    } else {
      const hasGoogleId = Boolean(user.googleId);
      const googleIdMatches = user.googleId && user.googleId === googleId;

      if (hasGoogleId && !googleIdMatches) {
        return res.status(403).json({ error: 'This Google account does not match the registered user.' });
      }

      user.googleId = user.googleId || googleId;
      user.name = user.name || googleUser.name || '';
      user.picture = user.picture || googleUser.picture || '';
      user.emailVerified = user.emailVerified || Boolean(googleUser.email_verified);
      user.authStatus = user.googleId && user.emailVerified ? 'verified' : user.authStatus;
      user.loginCount = (user.loginCount || 0) + 1;
      user.lastLoginAt = new Date();
      await user.save();
    }

    return res.json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        authStatus: user.authStatus,
        googleId: user.googleId,
        profileCompleted: user.profileCompleted,
      },
    });
  } catch (err) {
    console.error('Google auth error:', err.response?.data || err.message);
    return res.status(401).json({ error: 'Google authentication failed' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const userId = String(req.headers['x-user-id'] || '').trim();
    if (!userId) return res.status(401).json({ error: 'Missing user id' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      authStatus: user.authStatus,
      googleId: user.googleId,
      profileCompleted: user.profileCompleted,
    }});
  } catch (err) {
    return res.status(401).json({ error: 'Invalid user id' });
  }
});

module.exports = router;
