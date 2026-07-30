import prisma from '../config/database.js';
import { isMembershipActive } from '../middleware/membership.js';

const PROFILE_TYPE_BY_ACCOUNT = {
  OWNER: 'OWNER',
  BROKER: 'BROKER',
  BUILDER: 'BUILDER',
};

const AGENT_PROFILE_TYPES = new Set(['BROKER', 'BUILDER']);

function addDays(from, days) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function planLimitsFromRecord(plan) {
  if (!plan) return null;
  const features = plan.features && typeof plan.features === 'object' ? plan.features : {};
  return {
    maxListings: plan.maxListings,
    maxPhotos: features.maxPhotos ?? 20,
    maxVideos: features.maxVideos ?? 0,
    maxBoostsPerMonth: plan.maxBoosts,
    hasVerifiedBadge: plan.hasVerifiedBadge,
    hasFeaturedListing: Boolean(features.featuredListing),
    hasTopSearch: Boolean(features.topSearch),
  };
}

export async function findPlanByAccountAndTier(accountType, planTier) {
  return prisma.subscriptionPlan.findFirst({
    where: {
      accountType,
      planTier,
      isActive: true,
    },
  });
}

export async function listMembershipPlans(accountType) {
  return prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
      ...(accountType ? { accountType } : {}),
      accountType: accountType ? accountType : { not: null },
    },
    orderBy: [{ accountType: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      accountType: true,
      planTier: true,
      duration: true,
      price: true,
      currency: true,
      maxListings: true,
      maxFeatured: true,
      maxBoosts: true,
      hasVerifiedBadge: true,
      features: true,
      sortOrder: true,
    },
  });
}

export async function loadUserMembershipContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      membershipStatus: true,
      membershipExpiresAt: true,
      membershipPlanId: true,
      verifiedBadge: true,
      profileType: true,
      membershipPlan: true,
      _count: {
        select: {
          ownedProperties: {
            where: {
              status: { in: ['ACTIVE', 'DRAFT', 'UNDER_VERIFICATION'] },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const active = isMembershipActive(user);
  const limits = active ? planLimitsFromRecord(user.membershipPlan) : null;

  return {
    user,
    active,
    limits,
    usage: {
      activeListings: user._count.ownedProperties,
    },
  };
}

export function formatMembershipPayload(ctx) {
  if (!ctx) return null;

  const { user, active, limits, usage } = ctx;
  const plan = user.membershipPlan;

  return {
    status: active ? 'ACTIVE' : user.membershipStatus,
    expiresAt: user.membershipExpiresAt,
    verifiedBadge: user.verifiedBadge,
    accountType: plan?.accountType ?? null,
    planTier: plan?.planTier ?? null,
    planId: plan?.id ?? null,
    planName: plan?.name ?? null,
    priceInr: plan?.price ?? null,
    planDays: plan?.duration ?? null,
    limits,
    usage,
  };
}

/**
 * Activate or replace membership without payment (demo / admin).
 * Creates a Subscription row and updates User membership fields.
 */
export async function activateMembership({
  userId,
  accountType,
  planTier,
  source = 'DEMO',
  paymentId = null,
}) {
  const plan = await findPlanByAccountAndTier(accountType, planTier);
  if (!plan) {
    const err = new Error(`No plan found for ${accountType} / ${planTier}.`);
    err.status = 404;
    err.code = 'PLAN_NOT_FOUND';
    throw err;
  }

  const now = new Date();
  const endDate = addDays(now, plan.duration);
  const profileType = PROFILE_TYPE_BY_ACCOUNT[accountType] || 'OWNER';
  const role = AGENT_PROFILE_TYPES.has(profileType) ? 'AGENT' : 'USER';

  const result = await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelReason: `Replaced by ${source} activation`,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: now,
        endDate,
        autoRenew: false,
        paymentMethod: source,
        paymentId: paymentId || undefined,
        transactionId: paymentId || undefined,
        amount: plan.price,
        currency: plan.currency || 'INR',
      },
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        membershipStatus: 'ACTIVE',
        membershipExpiresAt: endDate,
        membershipPlanId: plan.id,
        verifiedBadge: plan.hasVerifiedBadge,
        profileType,
        role,
      },
      select: {
        id: true,
        membershipStatus: true,
        membershipExpiresAt: true,
        membershipPlanId: true,
        verifiedBadge: true,
        profileType: true,
        role: true,
      },
    });

    if (AGENT_PROFILE_TYPES.has(profileType)) {
      const agentVerified = Boolean(plan.hasVerifiedBadge);
      await tx.agentProfile.upsert({
        where: { userId },
        update: {
          subscriptionPlanId: plan.id,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: endDate,
          verifiedBadge: agentVerified,
        },
        create: {
          user: { connect: { id: userId } },
          subscriptionPlanId: plan.id,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: endDate,
          verifiedBadge: agentVerified,
        },
      });
    }

    return { user, subscription, plan };
  });

  return result;
}

const TIER_RANK = { BASIC: 1, MEDIUM: 2, PREMIUM: 3 };

/**
 * Upgrade an active membership to a higher tier (same account type).
 * Restarts the billing period on the new plan (demo / pre-Razorpay).
 */
export async function upgradeMembership({
  userId,
  planTier,
  source = 'DEMO_UPGRADE',
  paymentId = null,
}) {
  const ctx = await loadUserMembershipContext(userId);
  if (!ctx?.active) {
    const err = new Error('Active membership required before upgrading.');
    err.status = 402;
    err.code = 'MEMBERSHIP_REQUIRED';
    throw err;
  }

  const current = ctx.user.membershipPlan;
  if (!current?.accountType || !current?.planTier) {
    const err = new Error('No current plan found to upgrade from.');
    err.status = 400;
    err.code = 'NO_CURRENT_PLAN';
    throw err;
  }

  const nextTier = String(planTier || '').toUpperCase();
  const currentRank = TIER_RANK[current.planTier] ?? 0;
  const nextRank = TIER_RANK[nextTier] ?? 0;

  if (!nextRank) {
    const err = new Error('Invalid plan tier.');
    err.status = 400;
    err.code = 'INVALID_TIER';
    throw err;
  }

  if (nextRank <= currentRank) {
    const err = new Error(
      `Choose a higher plan than ${current.planTier}. Downgrades are not available here.`,
    );
    err.status = 400;
    err.code = 'UPGRADE_ONLY';
    err.meta = { currentTier: current.planTier, requestedTier: nextTier };
    throw err;
  }

  return activateMembership({
    userId,
    accountType: current.accountType,
    planTier: nextTier,
    source,
    paymentId,
  });
}

export async function assertCanCreateListing(userId) {
  const ctx = await loadUserMembershipContext(userId);
  if (!ctx?.active) {
    const err = new Error('Membership required. Please upgrade to list a property.');
    err.status = 402;
    err.code = 'MEMBERSHIP_REQUIRED';
    throw err;
  }

  const { limits, usage } = ctx;
  if (!limits) return ctx;

  const max = limits.maxListings;
  if (max >= 0 && usage.activeListings >= max) {
    const err = new Error(
      `Listing limit reached (${max}). Upgrade your plan to add more properties.`,
    );
    err.status = 403;
    err.code = 'LISTING_LIMIT_REACHED';
    err.meta = { maxListings: max, current: usage.activeListings };
    throw err;
  }

  return ctx;
}

export async function assertCanUploadImages(userId, propertyId, incomingCount) {
  const ctx = await loadUserMembershipContext(userId);
  const existingCount = await prisma.propertyImage.count({ where: { propertyId } });

  if (!ctx?.active) {
    if (existingCount + incomingCount > 20) {
      const err = new Error(`Max 20 images allowed. Currently ${existingCount}.`);
      err.status = 400;
      err.code = 'PHOTO_LIMIT_REACHED';
      throw err;
    }
    return ctx;
  }

  const maxPhotos = ctx.limits?.maxPhotos ?? 20;

  if (existingCount + incomingCount > maxPhotos) {
    const err = new Error(
      `Photo limit reached. Your plan allows up to ${maxPhotos} photos per listing.`,
    );
    err.status = 403;
    err.code = 'PHOTO_LIMIT_REACHED';
    err.meta = { maxPhotos, current: existingCount, incoming: incomingCount };
    throw err;
  }

  return ctx;
}
