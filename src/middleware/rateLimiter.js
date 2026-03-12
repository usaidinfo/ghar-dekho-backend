import rateLimit from 'express-rate-limit';
import { error } from '../utils/response.js';

const handler = (req, res) =>
  res.status(429).json(error('Too many requests. Please try again later.', null, 'RATE_LIMIT'));

// General API rate limit
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  handler,
  standardHeaders: true,
  legacyHeaders:   false,
});

// Strict limit for auth endpoints (OTP, login)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      10,
  handler,
  standardHeaders: true,
  legacyHeaders:   false,
});

// OTP send limit (stricter)
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      3,
  message:  'Too many OTP requests. Wait 1 minute.',
  handler,
  standardHeaders: true,
  legacyHeaders:   false,
});

