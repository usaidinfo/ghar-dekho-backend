import { verifyToken } from '../utils/jwt.js';
import { error } from '../utils/response.js';
import prisma from '../config/database.js';

/**
 * Protect route — requires valid JWT
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(error('Access denied. No token provided.', null, 'NO_TOKEN'));
    }

    const token = authHeader.split(' ')[1];
    const { valid, payload, error: tokenError } = verifyToken(token);

    if (!valid) {
      return res.status(401).json(error('Invalid or expired token.', null, 'INVALID_TOKEN'));
    }

    // Fetch fresh user from DB
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id:          true,
        email:       true,
        phone:       true,
        role:        true,
        profileType: true,
        isActive:    true,
        isBanned:    true,
        isEmailVerified: true,
        isPhoneVerified: true,
        profile:     { select: { firstName: true, lastName: true, profileImage: true } },
      },
    });

    if (!user)        return res.status(401).json(error('User not found.', null, 'USER_NOT_FOUND'));
    if (!user.isActive) return res.status(403).json(error('Account is deactivated.', null, 'ACCOUNT_INACTIVE'));
    if (user.isBanned)  return res.status(403).json(error('Account is banned.', null, 'ACCOUNT_BANNED'));

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json(error('Authentication failed.'));
  }
};

/**
 * Optional auth — attaches user if token present, but doesn't block
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    const token = authHeader.split(' ')[1];
    const { valid, payload } = verifyToken(token);
    if (!valid) {
      req.user = null;
      return next();
    }
    req.user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, profileType: true, isActive: true, isBanned: true },
    });
    next();
  } catch {
    req.user = null;
    next();
  }
};

/**
 * Restrict to specific roles
 * Usage: restrict('ADMIN', 'SUPER_ADMIN')
 */
export const restrict = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(error('Please log in first.'));
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json(
      error(`Access denied. Required role: ${roles.join(' or ')}.`, null, 'FORBIDDEN')
    );
  }
  next();
};

