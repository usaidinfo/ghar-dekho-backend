import jwt from 'jsonwebtoken';

const ACCESS_SECRET  = process.env.JWT_SECRET;
const ACCESS_EXPIRY  = process.env.JWT_EXPIRES_IN   || '7d';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export const signAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: REFRESH_EXPIRY });

export const verifyToken = (token) => {
  try {
    return { valid: true, payload: jwt.verify(token, ACCESS_SECRET) };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};

