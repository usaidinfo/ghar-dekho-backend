import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt.js';
import { success, error } from '../utils/response.js';
import { createOTP, verifyOTP } from '../services/otp.service.js';
import { sendOTPEmail, sendWelcomeEmail } from '../services/email.service.js';

// ─── Send OTP ────────────────────────────────────────────────
export const sendOTP = async (req, res) => {
  try {
    const { email, phone, type = 'EMAIL_VERIFICATION' } = req.body;

    if (!email && !phone) {
      return res.status(400).json(error('Email or phone is required.'));
    }

    const otp = await createOTP({ email, phone, type });

    // Send OTP via email (or SMS via Twilio if phone)
    if (email) {
      await sendOTPEmail(email, otp, type).catch(console.error);
    }

    // In development, return OTP directly for easy testing
    const devData = process.env.NODE_ENV === 'development' ? { otp } : {};

    return res.json(success(devData, `OTP sent successfully to ${email || phone}`));
  } catch (err) {
    console.error('sendOTP error:', err);
    return res.status(500).json(error('Failed to send OTP.'));
  }
};

// ─── Register with Email/Phone ────────────────────────────────
export const register = async (req, res) => {
  try {
    const { email, phone, password, firstName, lastName, profileType = 'BUYER', otp } = req.body;

    if (!email && !phone) {
      return res.status(400).json(error('Email or phone is required.'));
    }

    // Verify OTP before registration
    const otpType = email ? 'EMAIL_VERIFICATION' : 'PHONE_VERIFICATION';
    const otpResult = await verifyOTP({ email, phone, otp, type: otpType });
    if (!otpResult.valid) {
      return res.status(400).json(error(otpResult.reason, null, 'INVALID_OTP'));
    }

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });
    if (existing) {
      return res.status(409).json(error('An account with this email/phone already exists.', null, 'USER_EXISTS'));
    }

    const hashedPassword = password ? await bcrypt.hash(password, 12) : null;

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password:         hashedPassword,
        isEmailVerified:  !!email,
        isPhoneVerified:  !!phone,
        role:             profileType === 'AGENT' || profileType === 'BROKER' ? 'AGENT' : 'USER',
        profileType,
        profile: {
          create: { firstName, lastName },
        },
      },
      select: {
        id:              true,
        email:           true,
        phone:           true,
        role:            true,
        profileType:     true,
        isEmailVerified: true,
        isPhoneVerified: true,
        profile:         true,
        createdAt:       true,
      },
    });

    // Send welcome email
    if (email) {
      sendWelcomeEmail(email, firstName).catch(console.error);
    }

    const accessToken  = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId:     user.id,
        token:      refreshToken,
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress:  req.ip,
        expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return res.status(201).json(success({ user, accessToken, refreshToken }, 'Registration successful!'));
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json(error('Registration failed.'));
  }
};

// ─── Login with Email/Password ────────────────────────────────
export const loginWithPassword = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      include: { profile: true },
    });

    if (!user) {
      return res.status(401).json(error('Invalid credentials.', null, 'INVALID_CREDENTIALS'));
    }
    if (user.isBanned) {
      return res.status(403).json(error('Account is banned. Contact support.', null, 'ACCOUNT_BANNED'));
    }
    if (!user.password) {
      return res.status(400).json(error('This account uses OTP login. Please use OTP to sign in.'));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json(error('Invalid credentials.', null, 'INVALID_CREDENTIALS'));
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date(), lastLoginIp: req.ip },
    });

    const accessToken  = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId:     user.id,
        token:      refreshToken,
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress:  req.ip,
        expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const { password: _, ...safeUser } = user;
    return res.json(success({ user: safeUser, accessToken, refreshToken }, 'Login successful!'));
  } catch (err) {
    console.error('loginWithPassword error:', err);
    return res.status(500).json(error('Login failed.'));
  }
};

// ─── Login with OTP ───────────────────────────────────────────
export const loginWithOTP = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    const otpResult = await verifyOTP({ email, phone, otp, type: 'LOGIN' });
    if (!otpResult.valid) {
      return res.status(400).json(error(otpResult.reason, null, 'INVALID_OTP'));
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      include: { profile: true },
    });

    if (!user) {
      return res.status(404).json(error('Account not found. Please register first.', null, 'USER_NOT_FOUND'));
    }
    if (user.isBanned) {
      return res.status(403).json(error('Account is banned. Contact support.', null, 'ACCOUNT_BANNED'));
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  {
        lastLoginAt:     new Date(),
        lastLoginIp:     req.ip,
        isEmailVerified: email ? true : user.isEmailVerified,
        isPhoneVerified: phone ? true : user.isPhoneVerified,
      },
    });

    const accessToken  = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId:     user.id,
        token:      refreshToken,
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress:  req.ip,
        expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const { password: _, ...safeUser } = user;
    return res.json(success({ user: safeUser, accessToken, refreshToken }, 'Login successful!'));
  } catch (err) {
    console.error('loginWithOTP error:', err);
    return res.status(500).json(error('Login failed.'));
  }
};

// ─── Refresh Token ────────────────────────────────────────────
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json(error('Refresh token required.'));
    }

    const { valid, payload } = verifyToken(refreshToken);
    if (!valid) {
      return res.status(401).json(error('Invalid or expired refresh token.', null, 'INVALID_TOKEN'));
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      return res.status(401).json(error('Refresh token revoked or expired.', null, 'TOKEN_REVOKED'));
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive || user.isBanned) {
      return res.status(403).json(error('Account access denied.'));
    }

    const newAccessToken  = signAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = signRefreshToken({ userId: user.id });

    // Rotate: revoke old, create new
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data:  { isRevoked: true },
    });
    await prisma.refreshToken.create({
      data: {
        userId:     user.id,
        token:      newRefreshToken,
        deviceInfo: req.headers['user-agent'] || null,
        ipAddress:  req.ip,
        expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json(success({ accessToken: newAccessToken, refreshToken: newRefreshToken }, 'Token refreshed.'));
  } catch (err) {
    console.error('refreshAccessToken error:', err);
    return res.status(500).json(error('Token refresh failed.'));
  }
};

// ─── Logout ───────────────────────────────────────────────────
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId: req.user.id },
        data:  { isRevoked: true },
      });
    }
    return res.json(success(null, 'Logged out successfully.'));
  } catch (err) {
    console.error('logout error:', err);
    return res.status(500).json(error('Logout failed.'));
  }
};

// ─── Change Password ──────────────────────────────────────────
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (user.password) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json(error('Current password is incorrect.'));
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { password: hashedPassword },
    });

    // Revoke all refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId: req.user.id },
      data:  { isRevoked: true },
    });

    return res.json(success(null, 'Password changed successfully.'));
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json(error('Failed to change password.'));
  }
};

// ─── Forgot / Reset Password ──────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) {
      return res.status(400).json(error('Email or phone required.'));
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    // Don't reveal if user exists
    if (!user) {
      return res.json(success(null, 'If an account exists, an OTP will be sent.'));
    }

    const otp = await createOTP({ userId: user.id, email, phone, type: 'PASSWORD_RESET' });

    if (email) {
      await sendOTPEmail(email, otp, 'PASSWORD_RESET').catch(console.error);
    }

    const devData = process.env.NODE_ENV === 'development' ? { otp } : {};
    return res.json(success(devData, 'OTP sent for password reset.'));
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json(error('Failed to send reset OTP.'));
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, phone, otp, newPassword } = req.body;

    const otpResult = await verifyOTP({ email, phone, otp, type: 'PASSWORD_RESET' });
    if (!otpResult.valid) {
      return res.status(400).json(error(otpResult.reason, null, 'INVALID_OTP'));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.updateMany({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      data: { password: hashedPassword },
    });

    return res.json(success(null, 'Password reset successfully.'));
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json(error('Password reset failed.'));
  }
};

