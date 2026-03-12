import prisma from '../config/database.js';
import { success, error } from '../utils/response.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary.service.js';

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
    return res.json(success(user));
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
    const validTypes = ['OWNER', 'AGENT', 'BROKER', 'BUYER', 'RENTER'];
    if (!validTypes.includes(profileType)) {
      return res.status(400).json(error('Invalid profile type.'));
    }

    const newRole = (profileType === 'AGENT' || profileType === 'BROKER') ? 'AGENT' : 'USER';

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data:  { profileType, role: newRole },
      select: { id: true, role: true, profileType: true },
    });

    // Auto-create agent profile if switching to agent/broker
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

