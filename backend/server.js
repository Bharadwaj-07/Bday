require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const photoRoutes = require('./routes/photos');
const statsRoutes = require('./routes/stats');
const pinRoutes   = require('./routes/pins');
const musicRoutes = require('./routes/music');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ─── Allowed Origins ──────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.CLIENT_URL
    ? [process.env.CLIENT_URL,
       process.env.CLIENT_URL.replace(/^https?:\/\//, 'https://'),
       process.env.CLIENT_URL.replace(/^https?:\/\//, 'http://')]
    : []),
];

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
io.on('connection', socket => {
  console.log('🔌  Client connected:', socket.id);
  socket.on('disconnect', () => console.log('🔌  Client disconnected:', socket.id));
});
// Expose io globally so routes can emit events
app.set('io', io);

// ─── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { error: 'Too many upload requests, please try again later.' },
});
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/photos/upload', uploadLimiter);
app.use('/api', apiLimiter);

// ─── MongoDB Connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/photomap', {
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 300000,
  connectTimeoutMS: 30000,
})
  .then(() => console.log('✅  MongoDB connected'))
  .catch(err => { console.error('❌  MongoDB connection error:', err); process.exit(1); });

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('🔄  MongoDB reconnected'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/photos', photoRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/pins', pinRoutes);
app.use('/api/music', musicRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

server.listen(PORT, () => {
  console.log(`🚀  PhotoMap server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io };
