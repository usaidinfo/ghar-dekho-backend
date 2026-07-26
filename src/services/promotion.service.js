import prisma from '../config/database.js';
import { isMembershipActive } from '../middleware/membership.js';

function addDays(from, days) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function httpError(message, status = 400, code = 'BAD_REQUEST', meta = null) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.meta = meta;
  return err;
}

async function getConfigNumber(key, fallback) {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  if (!row?.value) return fallback;
  const raw = row.value;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const n = Number(raw.value);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function loadUserPlan(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      membershipStatus: true,
      membershipExpiresAt: true,
      membershipPlan: {
        select: {
          id: true,
          name: true,
          maxBoosts: true,
          maxFeatured: true,
          features: true,
        },
      },
    },
  });
}

export async function remainingBoostCredits(userId, plan) {
  const maxBoosts = plan?.maxBoosts ?? 0;
  if (maxBoosts === -1) return 999;
  if (!maxBoosts) return 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const used = await prisma.propertyPromotion.count({
    where: {
      userId,
      type: 'BOOST',
      createdAt: { gte: monthStart },
    },
  });

  return Math.max(0, maxBoosts - used);
}

async function remainingFeaturedSlots(userId, plan) {
  const maxFeatured = plan?.maxFeatured ?? 0;
  if (maxFeatured === -1) return 999;
  if (!maxFeatured) return 0;

  const now = new Date();
  const active = await prisma.propertyPromotion.count({
    where: {
      userId,
      type: 'FEATURED',
      status: 'ACTIVE',
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
  });

  return Math.max(0, maxFeatured - active);
}

async function expireStalePromotions(propertyId) {
  const now = new Date();
  await prisma.propertyPromotion.updateMany({
    where: {
      propertyId,
      status: 'ACTIVE',
      endsAt: { lte: now },
    },
    data: { status: 'EXPIRED' },
  });

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      isBoosted: true,
      boostedUntil: true,
      isFeatured: true,
      featuredUntil: true,
    },
  });
  if (!property) return;

  const data = {};
  if (property.isBoosted && property.boostedUntil && property.boostedUntil <= now) {
    data.isBoosted = false;
  }
  if (property.isFeatured && property.featuredUntil && property.featuredUntil <= now) {
    data.isFeatured = false;
  }
  if (Object.keys(data).length) {
    await prisma.property.update({ where: { id: propertyId }, data });
  }
}

async function assertCanPromote(userId, propertyId) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      agentId: true,
      isBoosted: true,
      boostedUntil: true,
      isFeatured: true,
      featuredUntil: true,
    },
  });

  if (!property) throw httpError('Property not found.', 404, 'NOT_FOUND');
  if (property.ownerId !== userId && property.agentId !== userId) {
    throw httpError('You can only promote your own listings.', 403, 'FORBIDDEN');
  }
  if (property.status !== 'ACTIVE') {
    throw httpError('Only active listings can be boosted or featured.', 400, 'LISTING_NOT_ACTIVE');
  }

  await expireStalePromotions(propertyId);
  return prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      agentId: true,
      isBoosted: true,
      boostedUntil: true,
      isFeatured: true,
      featuredUntil: true,
    },
  });
}

export async function getPromotionCredits(userId) {
  const user = await loadUserPlan(userId);
  if (!user) throw httpError('User not found.', 404, 'NOT_FOUND');

  const active = isMembershipActive(user);
  const plan = user.membershipPlan;
  const boostCredits = active ? await remainingBoostCredits(userId, plan) : 0;
  const featuredSlots = active ? await remainingFeaturedSlots(userId, plan) : 0;
  const boostDays = await getConfigNumber('boost_duration_days', 7);
  const featuredDays = await getConfigNumber('featured_listing_duration_days', 30);

  return {
    hasActiveMembership: active,
    boostCredits,
    maxBoosts: plan?.maxBoosts ?? 0,
    featuredSlots,
    maxFeatured: plan?.maxFeatured ?? 0,
    durations: { boostDays, featuredDays },
    planName: plan?.name ?? null,
  };
}

export async function boostProperty(userId, propertyId) {
  const user = await loadUserPlan(userId);
  if (!user || !isMembershipActive(user)) {
    throw httpError('Membership required to boost listings.', 402, 'MEMBERSHIP_REQUIRED');
  }

  const property = await assertCanPromote(userId, propertyId);
  const now = new Date();
  if (property.isBoosted && property.boostedUntil && property.boostedUntil > now) {
    throw httpError(
      `This listing is already boosted until ${property.boostedUntil.toISOString()}.`,
      409,
      'ALREADY_BOOSTED',
      { boostedUntil: property.boostedUntil },
    );
  }

  const credits = await remainingBoostCredits(userId, user.membershipPlan);
  if (credits <= 0) {
    throw httpError(
      'No boost credits left this month. Upgrade your plan for more.',
      403,
      'NO_BOOST_CREDITS',
      { boostCredits: 0, maxBoosts: user.membershipPlan?.maxBoosts ?? 0 },
    );
  }

  const boostDays = await getConfigNumber('boost_duration_days', 7);
  const endsAt = addDays(now, boostDays);

  const [promotion, updatedProperty] = await prisma.$transaction([
    prisma.propertyPromotion.create({
      data: {
        userId,
        propertyId,
        type: 'BOOST',
        status: 'ACTIVE',
        startsAt: now,
        endsAt,
      },
    }),
    prisma.property.update({
      where: { id: propertyId },
      data: {
        isBoosted: true,
        boostedUntil: endsAt,
      },
      select: {
        id: true,
        isBoosted: true,
        boostedUntil: true,
        isFeatured: true,
        featuredUntil: true,
      },
    }),
  ]);

  const boostCreditsRemaining = await remainingBoostCredits(userId, user.membershipPlan);

  return {
    promotion: {
      id: promotion.id,
      type: promotion.type,
      status: promotion.status,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
    },
    property: updatedProperty,
    boostCreditsRemaining,
  };
}

export async function featureProperty(userId, propertyId) {
  const user = await loadUserPlan(userId);
  if (!user || !isMembershipActive(user)) {
    throw httpError('Membership required to feature listings.', 402, 'MEMBERSHIP_REQUIRED');
  }

  const property = await assertCanPromote(userId, propertyId);
  const now = new Date();
  if (property.isFeatured && property.featuredUntil && property.featuredUntil > now) {
    throw httpError(
      `This listing is already featured until ${property.featuredUntil.toISOString()}.`,
      409,
      'ALREADY_FEATURED',
      { featuredUntil: property.featuredUntil },
    );
  }

  const slots = await remainingFeaturedSlots(userId, user.membershipPlan);
  if (slots <= 0) {
    throw httpError(
      'No featured slots available. Upgrade your plan for more.',
      403,
      'NO_FEATURED_SLOTS',
      { featuredSlots: 0, maxFeatured: user.membershipPlan?.maxFeatured ?? 0 },
    );
  }

  const featuredDays = await getConfigNumber('featured_listing_duration_days', 30);
  const endsAt = addDays(now, featuredDays);

  const promotion = await prisma.propertyPromotion.create({
    data: {
      userId,
      propertyId,
      type: 'FEATURED',
      status: 'ACTIVE',
      startsAt: now,
      endsAt,
    },
  });

  const updatedProperty = await prisma.property.update({
    where: { id: propertyId },
    data: {
      isFeatured: true,
      featuredUntil: endsAt,
    },
    select: {
      id: true,
      isBoosted: true,
      boostedUntil: true,
      isFeatured: true,
      featuredUntil: true,
    },
  });

  const featuredSlotsRemaining = await remainingFeaturedSlots(userId, user.membershipPlan);

  return {
    promotion: {
      id: promotion.id,
      type: promotion.type,
      status: promotion.status,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
    },
    property: updatedProperty,
    featuredSlotsRemaining,
  };
}
