function requireAuth(req, res, next) {
  const userId = String(req.headers['x-user-id'] || '').trim();

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = {
    sub: userId,
    email: 'session-user',
    name: 'Logged in user',
  };

  next();
}

module.exports = { requireAuth };
