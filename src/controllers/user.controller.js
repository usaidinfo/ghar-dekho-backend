import prisma from '../config/database.js';
import { success, error } from '../utils/response.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary.service.js';
import { verifyOTP } from '../services/otp.service.js';
import { formatMembershipPayload, loadUserMembershipContext } from '../services/membership.service.js';

// ─── Get Current User ────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id:              true,
        email:           true,
        phone:           true,
        role:            true,
        profileType:     true,
        isEmailVerified: true,
        isPhoneVerified: true,
        isKYCVerified:   true,
        kycStatus:       true,
        membershipStatus: true,
        membershipExpiresAt: true,
        verifiedBadge:   true,
        lastLoginAt:     true,
        createdAt:       true,
        profile:         true,
        agentProfile: {
          select: {
            id:             true,
            agencyName:     true,
            agencyLogo:     true,
            rating:         true,
            totalReviews:   true,
            totalProperties:true,
            isVerified:     true,
            verifiedBadge:  true,
            subscriptionStatus: true,
            subscriptionExpiresAt: true,
          },
        },
        _count: {
          select: {
            ownedProperties: true,
            wishlists:       true,
          },
        },
      },
    });

    if (!user) return res.status(404).json(error('User not found.'));

    const membershipCtx = await loadUserMembershipContext(user.id);
    const membership = formatMembershipPayload(membershipCtx);

    // adsEnabled: false for active paid members; true for free/inactive users.
    // The mobile app uses this to gate all ad placements — a paid member
    // will never see banners, interstitials, or app open ads.
    const adsEnabled = membership?.status !== 'ACTIVE';

    return res.json(success({ ...user, membership, adsEnabled }));
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json(error('Failed to fetch profile.'));
  }
};

// ─── Update Profile ───────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const {
      firstName, lastName, bio, gender, dateOfBirth,
      occupation, address, city, state, pincode, country,
      preferredLanguage,
    } = req.body;

    const existing = await prisma.profile.findUnique({ where: { userId: req.user.id } });

    const profile = existing
      ? await prisma.profile.update({
          where: { userId: req.user.id },
          data: {
            ...(firstName        && { firstName }),
            ...(lastName         && { lastName }),
            ...(bio              !== undefined && { bio }),
            ...(gender           && { gender }),
            ...(dateOfBirth      && { dateOfBirth: new Date(dateOfBirth) }),
            ...(occupation       && { occupation }),
            ...(address          && { address }),
            ...(city             && { city }),
            ...(state            && { state }),
            ...(pincode          && { pincode }),
            ...(country          && { country }),
            ...(preferredLanguage && { preferredLanguage }),
          },
        })
      : await prisma.profile.create({
          data: {
            userId: req.user.id,
            firstName: firstName || '',
            lastName:  lastName  || '',
            bio, gender, address, city, state, pincode, country, preferredLanguage,
            ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          },
        });

    return res.json(success(profile, 'Profile updated successfully.'));
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json(error('Failed to update profile.'));
  }
};

// ─── Upload Profile Image ─────────────────────────────────────
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(error('No image file provided.'));
    }

    const result = await uploadToCloudinary(req.file.buffer, 'profile-images', 'image');

    // Delete old image if exists
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.id } });
    if (profile?.profileImage) {
      // Try to delete old cloudinary image (best effort)
      const oldPublicId = profile.profileImage.split('/').pop()?.split('.')[0];
      if (oldPublicId) {
        deleteFromCloudinary(`ghar-dekho/profile-images/${oldPublicId}`).catch(console.error);
      }
    }

    const updated = await prisma.profile.update({
      where: { userId: req.user.id },
      data:  { profileImage: result.secure_url },
    });

    return res.json(success({ profileImage: result.secure_url }, 'Profile image uploaded successfully.'));
  } catch (err) {
    console.error('uploadProfileImage error:', err);
    return res.status(500).json(error('Failed to upload profile image.'));
  }
};

// ─── Get User by ID (public) ─────────────────────────────────
export const getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id:          true,
        role:        true,
        profileType: true,
        createdAt:   true,
        profile: {
          select: {
            firstName:    true,
            lastName:     true,
            profileImage: true,
            city:         true,
            state:        true,
          },
        },
        agentProfile: {
          select: {
            agencyName:     true,
            agencyLogo:     true,
            experience:     true,
            specialization: true,
            languages:      true,
            serviceAreas:   true,
            rating:         true,
            totalReviews:   true,
            totalProperties:true,
            totalDeals:     true,
            isVerified:     true,
            verifiedBadge:  true,
          },
        },
        reviewsReceived: {
          where:   { isPublished: true },
          orderBy: { createdAt: 'desc' },
          take:    5,
          select: {
            id:        true,
            rating:    true,
            title:     true,
            comment:   true,
            createdAt: true,
            reviewer: {
              select: {
                profile: { select: { firstName: true, lastName: true, profileImage: true } },
              },
            },
          },
        },
        _count: { select: { ownedProperties: { where: { status: 'ACTIVE' } } } },
      },
    });

    if (!user) return res.status(404).json(error('User not found.'));
    return res.json(success(user));
  } catch (err) {
    console.error('getUserById error:', err);
    return res.status(500).json(error('Failed to fetch user.'));
  }
};

// ─── Update Profile Type ──────────────────────────────────────
export const updateProfileType = async (req, res) => {
  try {
    const { profileType } = req.body;
    const validTypes = ['OWNER', 'AGENT', 'BROKER', 'BUILDER', 'BUYER', 'RENTER'];
    if (!validTypes.includes(profileType)) {
      return res.status(400).json(error('Invalid profile type.'));
    }

    const newRole = (profileType === 'AGENT' || profileType === 'BROKER' || profileType === 'BUILDER')
      ? 'AGENT'
      : 'USER';

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data:  { profileType, role: newRole },
      select: { id: true, role: true, profileType: true },
    });

    // Auto-create agent profile if switching to agent/broker/builder
    if (newRole === 'AGENT') {
      await prisma.agentProfile.upsert({
        where:  { userId: req.user.id },
        update: {},
        create: { userId: req.user.id },
      });
    }

    return res.json(success(user, 'Profile type updated.'));
  } catch (err) {
    console.error('updateProfileType error:', err);
    return res.status(500).json(error('Failed to update profile type.'));
  }
};

// ─── Get Recently Viewed Properties ──────────────────────────
export const getRecentlyViewed = async (req, res) => {
  try {
    const views = await prisma.propertyView.findMany({
      where:   { userId: req.user.id },
      orderBy: { viewedAt: 'desc' },
      take:    20,
      distinct: ['propertyId'],
      include: {
        property: {
          select: {
            id:           true,
            title:        true,
            price:        true,
            city:         true,
            locality:     true,
            propertyType: true,
            listingType:  true,
            bhk:          true,
            carpetArea:   true,
            isVerified:   true,
            images: {
              where:   { isPrimary: true },
              take:    1,
              select:  { imageUrl: true, thumbnailUrl: true },
            },
          },
        },
      },
    });

    const properties = views
      .filter((v) => v.property)
      .map((v) => ({ ...v.property, viewedAt: v.viewedAt }));

    return res.json(success(properties));
  } catch (err) {
    console.error('getRecentlyViewed error:', err);
    return res.status(500).json(error('Failed to fetch recently viewed properties.'));
  }
};

// ─── Get My Notifications ─────────────────────────────────────
export const getNotifications = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(50, parseInt(req.query.limit || '20'));
    const skip  = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where:   { userId: req.user.id, ...(unreadOnly && { isRead: false }) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    return res.json(success({ notifications, unreadCount, total, page, limit }));
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json(error('Failed to fetch notifications.'));
  }
};

// ─── Add Missing Contact (email or phone) via OTP ─────────────
/**
 * Attach a missing email or phone to the currently authenticated user.
 *
 * Body:  { email?: string, phone?: string, otp: string }
 * Rules:
 *  - Exactly one of `email` or `phone` must be provided.
 *  - The user must NOT already have that contact set
 *    (this endpoint is for "add when missing", not "change existing").
 *  - The supplied OTP must be a valid EMAIL_VERIFICATION / PHONE_VERIFICATION
 *    code created via /api/auth/send-otp for that identifier.
 *  - The contact must be unique across users.
 */
export const addMyContact = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    if ((!email && !phone) || (email && phone)) {
      return res
        .status(400)
        .json(error('Provide either email OR phone (not both).', null, 'BAD_REQUEST'));
    }
    if (!otp) {
      return res.status(400).json(error('OTP is required.', null, 'BAD_REQUEST'));
    }

    const emailNorm = email ? String(email).trim().toLowerCase() : null;
    const phoneRaw = phone ? String(phone).trim() : null;
    const phoneDigits = phoneRaw ? phoneRaw.replace(/\D/g, '') : '';
    const phoneNormalized = phoneRaw
      ? phoneRaw.startsWith('+')
        ? phoneRaw
        : phoneDigits.length === 10
          ? `+91${phoneDigits}`
          : phoneDigits.length >= 11
            ? `+${phoneDigits}`
            : phoneRaw
      : null;

    // Reject if user already has this contact set.
    const current = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, phone: true },
    });
    if (!current) {
      return res.status(404).json(error('User not found.'));
    }
    if (emailNorm && current.email) {
      return res
        .status(409)
        .json(error('Email is already set on this account.', null, 'EMAIL_EXISTS'));
    }
    if (phoneNormalized && current.phone) {
      return res
        .status(409)
        .json(error('Phone is already set on this account.', null, 'PHONE_EXISTS'));
    }

    // Reject if another account already uses it.
    const taken = await prisma.user.findFirst({
      where: {
        OR: [
          ...(emailNorm ? [{ email: emailNorm }] : []),
          ...(phoneNormalized ? [{ phone: phoneNormalized }] : []),
        ],
        NOT: { id: req.user.id },
      },
      select: { id: true },
    });
    if (taken) {
      return res
        .status(409)
        .json(
          error(
            emailNorm
              ? 'This email is already in use by another account.'
              : 'This phone number is already in use by another account.',
            null,
            'CONTACT_TAKEN',
          ),
        );
    }

    // Verify OTP (issued with EMAIL_VERIFICATION or PHONE_VERIFICATION type).
    const otpType = emailNorm ? 'EMAIL_VERIFICATION' : 'PHONE_VERIFICATION';
    const otpResult = await verifyOTP({
      email: emailNorm,
      phone: phoneNormalized,
      otp,
      type: otpType,
    });
    if (!otpResult.valid) {
      return res.status(400).json(error(otpResult.reason, null, 'INVALID_OTP'));
    }

    // Attach + mark verified.
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(emailNorm ? { email: emailNorm, isEmailVerified: true } : {}),
        ...(phoneNormalized ? { phone: phoneNormalized, isPhoneVerified: true } : {}),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    return res.json(success(updated, 'Contact added successfully.'));
  } catch (err) {
    console.error('addMyContact error:', err);
    return res.status(500).json(error('Failed to add contact.'));
  }
};

// ─── Mark Notifications Read ──────────────────────────────────
export const markNotificationsRead = async (req, res) => {
  try {
    const { ids } = req.body; // array of notification ids, or empty for all

    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        ...(ids?.length ? { id: { in: ids } } : {}),
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return res.json(success(null, 'Notifications marked as read.'));
  } catch (err) {
    console.error('markNotificationsRead error:', err);
    return res.status(500).json(error('Failed to update notifications.'));
  }
};

