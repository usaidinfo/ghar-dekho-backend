import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { initSocket } from './config/socket.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { error } from './utils/response.js';

// ── Routes ────────────────────────────────────────────────────
import authRoutes     from './routes/auth.routes.js';
import userRoutes     from './routes/user.routes.js';
import propertyRoutes from './routes/property.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import chatRoutes     from './routes/chat.routes.js';
import meetingRoutes  from './routes/meeting.routes.js';

const app        = express();
const httpServer = createServer(app);
const PORT       = process.env.PORT || 5000;

// ── Socket.io ─────────────────────────────────────────────────
export const io = initSocket(httpServer);
/** Lets HTTP controllers (e.g. chat media upload) broadcast the same events as the socket handler */
app.set('io', io);

// ── Global Middleware ─────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalLimiter);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'OK',
    message:   'Ghar Dekho API is running',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/wishlist',   wishlistRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/meetings',   meetingRoutes);

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json(error(`Route ${req.method} ${req.originalUrl} not found.`, null, 'NOT_FOUND'));
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json(error('Duplicate entry. This record already exists.', null, 'DUPLICATE'));
  }
  if (err.code === 'P2025') {
    return res.status(404).json(error('Record not found.', null, 'NOT_FOUND'));
  }

  res.status(err.status || 500).json(
    error(
      err.message || 'Internal server error',
      null,
      'SERVER_ERROR',
      ...(process.env.NODE_ENV === 'development' ? [{ stack: err.stack }] : [])
    )
  );
});

// ── Start Server ──────────────────────────────────────────────
// Bind to all interfaces so Android devices/emulators can reach it.
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\n🏠 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Ghar Dekho Backend API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Server    : http://localhost:${PORT} (bound 0.0.0.0)`);
  console.log(`🔗 Health    : http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.io : ws://localhost:${PORT}`);
  console.log(`📝 Env       : ${process.env.NODE_ENV || 'development'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📡 API Endpoints:');
  console.log('   POST /api/auth/send-otp');
  console.log('   POST /api/auth/register');
  console.log('   POST /api/auth/login');
  console.log('   POST /api/auth/login-otp');
  console.log('   GET  /api/users/me');
  console.log('   GET  /api/properties');
  console.log('   GET  /api/properties/search');
  console.log('   GET  /api/properties/featured');
  console.log('   GET  /api/properties/trending-areas');
  console.log('   GET  /api/properties/nearby');
  console.log('   POST /api/properties');
  console.log('   GET  /api/wishlist');
  console.log('   GET  /api/chat/sessions');
  console.log('   GET  /api/meetings');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

export default app;
