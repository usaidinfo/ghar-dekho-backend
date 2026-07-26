import prisma from '../../config/database.js';
import { isMembershipActive } from '../../middleware/membership.js';
import { remainingBoostCredits as remainingBoostCreditsShared } from '../promotion.service.js';
import {
  addDays,
  daysBetween,
  experienceLabelToYears,
  formatInr,
  initialsFromName,
  intentScoreFromLead,
  languagesToArray,
  languagesToString,
  listingStatusForUi,
  mapLeadStatusToStage,
  maskPhone,
  normalizePermissions,
  parsePeriodDays,
  primaryImageUrl,
  propertyLocation,
  startOfDay,
  tierLabelFromPlan,
  yearsToExperienceLabel,
} from './agent.helpers.js';

const LEAD_INCLUDE = {
  property: {
    select: {
      id: true,
      title: true,
      price: true,
      city: true,
      locality: true,
      isFeatured: true,
      isBoosted: true,
      status: true,
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { imageUrl: true, thumbnailUrl: true, isPrimary: true },
      },
    },
  },
  buyer: {
    select: {
      id: true,
      phone: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
};

function propertyWhereForAgent(userId) {
  return {
    OR: [{ ownerId: userId }, { agentId: userId }],
  };
}

function leadWhereForAgent(agentProfileId, userId) {
  return {
    OR: [{ agentId: agentProfileId }, { ownerId: userId }],
  };
}

function leadName(buyer) {
  const first = buyer?.profile?.firstName || '';
  const last = buyer?.profile?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || 'Buyer';
}

function mapLead(lead) {
  const stage = mapLeadStatusToStage(lead.status);
  const isUrgent =
    lead.priority === 'URGENT' ||
    lead.priority === 'HIGH' ||
    (lead.followUpAt && new Date(lead.followUpAt) < new Date());

  return {
    id: lead.id,
    leadName: leadName(lead.buyer),
    maskedPhone: maskPhone(lead.buyer?.phone),
    stage,
    propertyTitle: lead.property?.title || 'Property',
    propertyLocation: propertyLocation(lead.property),
    propertyPrice: formatInr(lead.property?.price),
    propertyImage: primaryImageUrl(lead.property),
    propertyTag: lead.source || undefined,
    budgetRange: lead.budget != null ? formatInr(lead.budget) : undefined,
    timeline: undefined,
    requirements: lead.requirements || undefined,
    lastActivityAt: (lead.lastContactAt || lead.updatedAt || lead.createdAt).toISOString(),
    isUrgent: Boolean(isUrgent),
    isShared: false,
    sharedWith: [],
    lastNote: lead.notes || undefined,
    intentScore: intentScoreFromLead(lead),
    nextFollowUp: lead.followUpAt ? lead.followUpAt.toISOString() : undefined,
    priority: lead.priority,
    source: lead.source,
    propertyId: lead.propertyId,
    buyerId: lead.buyerId,
  };
}

async function getWishlistCounts(propertyIds) {
  if (!propertyIds.length) return new Map();
  const rows = await prisma.wishlist.groupBy({
    by: ['propertyId'],
    where: { propertyId: { in: propertyIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.propertyId, r._count._all]));
}

async function getAnalyticsSums(propertyIds, fromDate) {
  if (!propertyIds.length) return new Map();
  const rows = await prisma.propertyAnalytics.groupBy({
    by: ['propertyId'],
    where: {
      propertyId: { in: propertyIds },
      ...(fromDate ? { date: { gte: fromDate } } : {}),
    },
    _sum: {
      views: true,
      leads: true,
      wishlistAdds: true,
      calls: true,
    },
  });
  return new Map(
    rows.map((r) => [
      r.propertyId,
      {
        views: r._sum.views || 0,
        leads: r._sum.leads || 0,
        saves: r._sum.wishlistAdds || 0,
        calls: r._sum.calls || 0,
      },
    ]),
  );
}

async function mapListings(properties, { periodDays = 30 } = {}) {
  const ids = properties.map((p) => p.id);
  const fromDate = addDays(startOfDay(), -periodDays);
  const prevFrom = addDays(fromDate, -periodDays);

  const [wishlistCounts, currentStats, prevWindowStats] = await Promise.all([
    getWishlistCounts(ids),
    getAnalyticsSums(ids, fromDate),
    prisma.propertyAnalytics.groupBy({
      by: ['propertyId'],
      where: {
        propertyId: { in: ids },
        date: { gte: prevFrom, lt: fromDate },
      },
      _sum: { views: true },
    }),
  ]);
  const prevViewsMap = new Map(prevWindowStats.map((r) => [r.propertyId, r._sum.views || 0]));

  const sortedByViews = [...properties].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const topIds = new Set(sortedByViews.slice(0, 3).map((p) => p.id));

  return properties.map((p) => {
    const stats = currentStats.get(p.id) || {};
    const views = stats.views || p.viewCount || 0;
    const prevViews = prevViewsMap.get(p.id) || 0;
    let viewsChange;
    if (prevViews > 0) {
      viewsChange = Math.round(((views - prevViews) / prevViews) * 100);
    } else if (views > 0) {
      viewsChange = 100;
    } else {
      viewsChange = 0;
    }

    return {
      id: p.id,
      title: p.title,
      location: propertyLocation(p),
      price: formatInr(p.price),
      image: primaryImageUrl(p),
      status: listingStatusForUi(p.status),
      isFeatured: Boolean(p.isFeatured),
      isTopPerformer: topIds.has(p.id) && (p.viewCount || 0) > 0,
      views,
      leads: stats.leads || p.leadCount || 0,
      saves: stats.saves || wishlistCounts.get(p.id) || 0,
      calls: stats.calls || 0,
      viewsChange,
    };
  });
}

async function loadMembership(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      membershipStatus: true,
      membershipExpiresAt: true,
      membershipPlanId: true,
      profileType: true,
      membershipPlan: {
        select: {
          id: true,
          name: true,
          accountType: true,
          planTier: true,
          maxBoosts: true,
          maxTeamMembers: true,
          hasAnalytics: true,
        },
      },
    },
  });
  return user;
}

async function remainingBoostCredits(userId, plan) {
  return remainingBoostCreditsShared(userId, plan);
}


export async function getDashboard(userId, agentProfile) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = addDays(todayStart, -7);
  const prevWeekStart = addDays(weekStart, -7);

  const propWhere = propertyWhereForAgent(userId);
  const leadWhere = leadWhereForAgent(agentProfile.id, userId);

  const [
    user,
    activeListings,
    listingsThisWeek,
    listingsPrevWeek,
    newLeadsToday,
    urgentLeads,
    pipelineGroups,
    visitsThisWeek,
    convertedCount,
    totalLeads,
    topProperties,
    highPriorityToday,
  ] = await Promise.all([
    loadMembership(userId),
    prisma.property.count({ where: { ...propWhere, status: 'ACTIVE' } }),
    prisma.property.count({
      where: { ...propWhere, status: 'ACTIVE', createdAt: { gte: weekStart } },
    }),
    prisma.property.count({
      where: {
        ...propWhere,
        status: 'ACTIVE',
        createdAt: { gte: prevWeekStart, lt: weekStart },
      },
    }),
    prisma.leadManagement.count({
      where: { ...leadWhere, createdAt: { gte: todayStart } },
    }),
    prisma.leadManagement.findMany({
      where: {
        AND: [
          leadWhere,
          { status: { notIn: ['CONVERTED', 'LOST', 'NOT_INTERESTED'] } },
          {
            OR: [
              { priority: { in: ['URGENT', 'HIGH'] } },
              { followUpAt: { lte: now } },
            ],
          },
        ],
      },
      include: LEAD_INCLUDE,
      orderBy: [{ followUpAt: 'asc' }, { updatedAt: 'desc' }],
      take: 5,
    }),
    prisma.leadManagement.groupBy({
      by: ['status'],
      where: leadWhere,
      _count: { _all: true },
    }),
    prisma.meeting.count({
      where: {
        ownerId: userId,
        scheduledAt: { gte: weekStart },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'COMPLETED'] },
      },
    }),
    prisma.leadManagement.count({ where: { ...leadWhere, status: 'CONVERTED' } }),
    prisma.leadManagement.count({ where: leadWhere }),
    prisma.property.findMany({
      where: { ...propWhere, status: 'ACTIVE' },
      orderBy: [{ viewCount: 'desc' }, { leadCount: 'desc' }],
      take: 5,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { imageUrl: true, thumbnailUrl: true, isPrimary: true },
        },
      },
    }),
    prisma.leadManagement.findFirst({
      where: { ...leadWhere, createdAt: { gte: todayStart } },
      orderBy: { priority: 'desc' },
      select: { priority: true },
    }),
  ]);

  const statusCount = Object.fromEntries(
    pipelineGroups.map((g) => [g.status, g._count._all]),
  );

  const pipeline = {
    new: statusCount.NEW || 0,
    contacted: (statusCount.CONTACTED || 0) + (statusCount.INTERESTED || 0),
    visit: statusCount.VISIT_SCHEDULED || 0,
    negotiation: statusCount.NEGOTIATION || 0,
    converted: statusCount.CONVERTED || 0,
  };

  const conversionRate =
    totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

  const priorityLabel = highPriorityToday?.priority
    ? `${highPriorityToday.priority} PRIORITY`
    : newLeadsToday > 0
      ? 'NEW LEADS'
      : 'NONE';

  const topListings = await mapListings(topProperties);
  const plan = user?.membershipPlan;
  const activeMembership = user && isMembershipActive(user);
  const daysRemaining =
    activeMembership && user.membershipExpiresAt
      ? daysBetween(now, user.membershipExpiresAt)
      : 0;

  const firstName = (
    await prisma.profile.findUnique({
      where: { userId },
      select: { firstName: true },
    })
  )?.firstName;

  return {
    agentName: firstName || 'Agent',
    tierLabel: activeMembership
      ? tierLabelFromPlan(plan, user?.profileType)
      : 'Free Tier',
    kpi: {
      activeListings,
      activeListingsChange: listingsThisWeek - listingsPrevWeek,
      newLeadsToday,
      newLeadsPriority: priorityLabel,
      visitsThisWeek,
      visitsNote: visitsThisWeek > 0 ? 'Scheduled this week' : 'No visits scheduled',
      conversionRate,
    },
    pipeline,
    urgentFollowUps: urgentLeads.map(mapLead),
    topListings,
    membership: activeMembership
      ? {
          planLabel: plan?.name || tierLabelFromPlan(plan, user?.profileType),
          daysRemaining,
        }
      : null,
  };
}


export async function listLeads(userId, agentProfile, { stage, page = 1, limit = 50 } = {}) {
  const filters = [leadWhereForAgent(agentProfile.id, userId)];

  if (stage && stage !== 'ALL') {
    const normalized = String(stage).toUpperCase();
    if (normalized === 'LOST') {
      filters.push({ status: { in: ['LOST', 'NOT_INTERESTED'] } });
    } else {
      filters.push({ status: normalized });
    }
  }

  const where = filters.length === 1 ? filters[0] : { AND: filters };

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.leadManagement.findMany({
      where,
      include: LEAD_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.leadManagement.count({ where }),
  ]);

  return { leads: rows.map(mapLead), total, page, limit };
}


export async function getLeadDetail(userId, agentProfile, leadId) {
  const lead = await prisma.leadManagement.findFirst({
    where: {
      id: leadId,
      ...leadWhereForAgent(agentProfile.id, userId),
    },
    include: LEAD_INCLUDE,
  });

  if (!lead) {
    const err = new Error('Lead not found.');
    err.status = 404;
    err.code = 'LEAD_NOT_FOUND';
    throw err;
  }

  const mapped = mapLead(lead);
  const activities = [];

  activities.push({
    id: `${lead.id}-created`,
    type: 'CREATED',
    title: 'Lead received',
    description: `Source: ${lead.source}`,
    at: lead.createdAt.toISOString(),
  });

  if (lead.lastContactAt) {
    activities.push({
      id: `${lead.id}-contact`,
      type: 'CONTACT',
      title: 'Contact logged',
      description: lead.notes || 'Follow-up recorded',
      at: lead.lastContactAt.toISOString(),
    });
  }

  if (lead.followUpAt) {
    activities.push({
      id: `${lead.id}-followup`,
      type: 'FOLLOW_UP',
      title: 'Follow-up scheduled',
      description: null,
      at: lead.followUpAt.toISOString(),
    });
  }

  if (lead.convertedAt) {
    activities.push({
      id: `${lead.id}-converted`,
      type: 'CONVERTED',
      title: 'Marked converted',
      description: null,
      at: lead.convertedAt.toISOString(),
    });
  }

  activities.sort((a, b) => new Date(b.at) - new Date(a.at));

  return { ...mapped, activities };
}


export async function updateLead(userId, agentProfile, leadId, payload) {
  const existing = await prisma.leadManagement.findFirst({
    where: {
      id: leadId,
      ...leadWhereForAgent(agentProfile.id, userId),
    },
  });

  if (!existing) {
    const err = new Error('Lead not found.');
    err.status = 404;
    err.code = 'LEAD_NOT_FOUND';
    throw err;
  }

  const data = {};

  if (payload.stage) {
    const stage = String(payload.stage).toUpperCase();
    data.status = stage === 'LOST' ? 'LOST' : stage;
    if (stage === 'CONVERTED') data.convertedAt = new Date();
    if (['CONTACTED', 'INTERESTED', 'VISIT_SCHEDULED', 'NEGOTIATION'].includes(stage)) {
      data.lastContactAt = new Date();
    }
  }

  if (payload.priority) {
    data.priority = String(payload.priority).toUpperCase();
  }

  if (payload.notes !== undefined) data.notes = payload.notes;
  if (payload.requirements !== undefined) data.requirements = payload.requirements;
  if (payload.budget !== undefined) {
    data.budget = payload.budget == null ? null : Number(payload.budget);
  }
  if (payload.followUpAt !== undefined) {
    data.followUpAt = payload.followUpAt ? new Date(payload.followUpAt) : null;
  }

  const updated = await prisma.leadManagement.update({
    where: { id: leadId },
    data,
    include: LEAD_INCLUDE,
  });

  return mapLead(updated);
}


export async function listListings(userId, { status, page = 1, limit = 50 } = {}) {
  const where = { ...propertyWhereForAgent(userId) };

  if (status && status !== 'ALL') {
    const s = String(status).toUpperCase();
    if (s === 'SOLD' || s === 'RENTED') {
      where.status = { in: ['SOLD', 'RENTED'] };
    } else if (s === 'DRAFT') {
      where.status = { in: ['DRAFT', 'UNDER_VERIFICATION', 'INACTIVE'] };
    } else {
      where.status = s;
    }
  }

  const skip = (page - 1) * limit;
  const [rows, total, activeCount, leadAgg] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { imageUrl: true, thumbnailUrl: true, isPrimary: true },
        },
      },
    }),
    prisma.property.count({ where }),
    prisma.property.count({
      where: { ...propertyWhereForAgent(userId), status: 'ACTIVE' },
    }),
    prisma.property.aggregate({
      where: propertyWhereForAgent(userId),
      _sum: { leadCount: true },
    }),
  ]);

  const listings = await mapListings(rows);

  return {
    listings,
    summary: {
      activeCount,
      totalCount: await prisma.property.count({ where: propertyWhereForAgent(userId) }),
      totalLeads: leadAgg._sum.leadCount || 0,
    },
    total,
    page,
    limit,
  };
}


export async function getListingPerformance(userId, agentProfile, listingId, { period = '30D' } = {}) {
  const property = await prisma.property.findFirst({
    where: { id: listingId, ...propertyWhereForAgent(userId) },
    include: {
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { imageUrl: true, thumbnailUrl: true, isPrimary: true },
      },
    },
  });

  if (!property) {
    const err = new Error('Listing not found.');
    err.status = 404;
    err.code = 'LISTING_NOT_FOUND';
    throw err;
  }

  const days = parsePeriodDays(period);
  const fromDate = addDays(startOfDay(), -days);

  const [mapped] = await mapListings([property], { periodDays: days });

  const daily = await prisma.propertyAnalytics.findMany({
    where: { propertyId: listingId, date: { gte: fromDate } },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      views: true,
      leads: true,
      wishlistAdds: true,
      calls: true,
    },
  });

  const series = daily.map((d) => ({
    date: d.date.toISOString(),
    views: d.views,
    leads: d.leads,
    saves: d.wishlistAdds,
    calls: d.calls,
  }));

  const recentLeads = await prisma.leadManagement.findMany({
    where: {
      AND: [
        { propertyId: listingId },
        leadWhereForAgent(agentProfile.id, userId),
      ],
    },
    include: LEAD_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    listing: mapped,
    series,
    recentLeads: recentLeads.map(mapLead),
    period: `${days}D`,
  };
}


export async function getAnalytics(userId, agentProfile, { period = '30D' } = {}) {
  const days = parsePeriodDays(period);
  const fromDate = addDays(startOfDay(), -days);
  const propWhere = propertyWhereForAgent(userId);
  const leadWhere = leadWhereForAgent(agentProfile.id, userId);

  const properties = await prisma.property.findMany({
    where: propWhere,
    select: { id: true, price: true, status: true, viewCount: true, leadCount: true },
  });
  const propertyIds = properties.map((p) => p.id);

  const [agentDaily, propertyDaily, leads, convertedLeads, meetings] = await Promise.all([
    prisma.agentAnalytics.findMany({
      where: { agentId: agentProfile.id, date: { gte: fromDate } },
      orderBy: { date: 'asc' },
    }),
    propertyIds.length
      ? prisma.propertyAnalytics.groupBy({
          by: ['date'],
          where: { propertyId: { in: propertyIds }, date: { gte: fromDate } },
          _sum: {
            views: true,
            leads: true,
            meetings: true,
            calls: true,
          },
          orderBy: { date: 'asc' },
        })
      : Promise.resolve([]),
    prisma.leadManagement.count({
      where: { ...leadWhere, createdAt: { gte: fromDate } },
    }),
    prisma.leadManagement.findMany({
      where: {
        ...leadWhere,
        status: 'CONVERTED',
        convertedAt: { gte: fromDate },
      },
      select: {
        convertedAt: true,
        createdAt: true,
        property: { select: { price: true } },
      },
    }),
    prisma.meeting.count({
      where: {
        ownerId: userId,
        scheduledAt: { gte: fromDate },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'COMPLETED'] },
      },
    }),
  ]);

  const views =
    propertyDaily.reduce((sum, d) => sum + (d._sum.views || 0), 0) ||
    properties.reduce((sum, p) => sum + (p.viewCount || 0), 0);

  const deals = convertedLeads.length;
  const revenue = convertedLeads.reduce(
    (sum, l) => sum + (l.property?.price || 0),
    0,
  );

  const avgConversionDays =
    deals > 0
      ? Math.round(
          convertedLeads.reduce((sum, l) => {
            const end = l.convertedAt || new Date();
            return sum + daysBetween(l.createdAt, end);
          }, 0) / deals,
        )
      : 0;

  const series =
    agentDaily.length > 0
      ? agentDaily.map((d) => ({
          date: d.date.toISOString(),
          views: d.totalViews,
          leads: d.totalLeads,
          visits: d.totalMeetings,
          deals: d.conversions,
          revenue: d.revenue,
        }))
      : propertyDaily.map((d) => ({
          date: d.date.toISOString(),
          views: d._sum.views || 0,
          leads: d._sum.leads || 0,
          visits: d._sum.meetings || 0,
          deals: 0,
          revenue: 0,
        }));

  const conversionRate = leads > 0 ? Math.round((deals / leads) * 1000) / 10 : 0;

  return {
    period: `${days}D`,
    revenue,
    revenueLabel: formatInr(revenue),
    revenueChangePercent: null,
    avgConversionDays,
    conversionRate,
    funnel: {
      views,
      leads,
      visits: meetings,
      deals,
    },
    series,
    insight:
      deals > 0
        ? `You closed ${deals} deal${deals === 1 ? '' : 's'} in the last ${days} days.`
        : `No conversions yet in the last ${days} days — focus on follow-ups.`,
  };
}


export async function getTeam(userId, agentProfile) {
  const [members, activeListings, user] = await Promise.all([
    prisma.teamMember.findMany({
      where: { agentId: agentProfile.id, isActive: true },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.property.count({
      where: { ...propertyWhereForAgent(userId), status: 'ACTIVE' },
    }),
    loadMembership(userId),
  ]);

  const team = members.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    avatarInitials: initialsFromName(m.name),
    avatarImage: null,
    activeListings: 0,
    permissions: normalizePermissions(m.permissions),
    email: m.email || undefined,
    phone: m.phone || undefined,
  }));
  if (team.length > 0 && activeListings > 0) {
    const base = Math.floor(activeListings / team.length);
    let rem = activeListings % team.length;
    team.forEach((m) => {
      m.activeListings = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    });
  }

  return {
    members: team,
    summary: {
      totalMembers: team.length,
      totalActiveListings: activeListings,
      maxTeamMembers: user?.membershipPlan?.maxTeamMembers ?? 0,
      tierLabel: tierLabelFromPlan(user?.membershipPlan, user?.profileType),
    },
  };
}

export async function addTeamMember(userId, agentProfile, payload) {
  const user = await loadMembership(userId);
  const max = user?.membershipPlan?.maxTeamMembers ?? 0;
  const current = await prisma.teamMember.count({
    where: { agentId: agentProfile.id, isActive: true },
  });

  if (max !== -1 && current >= max) {
    const err = new Error(
      max === 0
        ? 'Your plan does not include team members. Upgrade to add a team.'
        : `Team limit reached (${max}). Upgrade your plan to add more members.`,
    );
    err.status = 403;
    err.code = 'TEAM_LIMIT';
    throw err;
  }

  const member = await prisma.teamMember.create({
    data: {
      agentId: agentProfile.id,
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      role: payload.role?.trim() || 'Agent',
      permissions: normalizePermissions(payload.permissions),
      isActive: true,
    },
  });

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    avatarInitials: initialsFromName(member.name),
    avatarImage: null,
    activeListings: 0,
    permissions: normalizePermissions(member.permissions),
  };
}

export async function updateTeamMember(userId, agentProfile, memberId, payload) {
  const existing = await prisma.teamMember.findFirst({
    where: { id: memberId, agentId: agentProfile.id },
  });
  if (!existing) {
    const err = new Error('Team member not found.');
    err.status = 404;
    err.code = 'TEAM_MEMBER_NOT_FOUND';
    throw err;
  }

  const data = {};
  if (payload.name !== undefined) data.name = payload.name.trim();
  if (payload.email !== undefined) data.email = payload.email?.trim() || null;
  if (payload.phone !== undefined) data.phone = payload.phone?.trim() || null;
  if (payload.role !== undefined) data.role = payload.role.trim();
  if (payload.permissions !== undefined) {
    data.permissions = normalizePermissions(payload.permissions);
  }
  if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);

  const member = await prisma.teamMember.update({
    where: { id: memberId },
    data,
  });

  return {
    id: member.id,
    name: member.name,
    role: member.role,
    avatarInitials: initialsFromName(member.name),
    avatarImage: null,
    activeListings: 0,
    permissions: normalizePermissions(member.permissions),
  };
}

export async function removeTeamMember(userId, agentProfile, memberId) {
  const existing = await prisma.teamMember.findFirst({
    where: { id: memberId, agentId: agentProfile.id },
  });
  if (!existing) {
    const err = new Error('Team member not found.');
    err.status = 404;
    err.code = 'TEAM_MEMBER_NOT_FOUND';
    throw err;
  }

  await prisma.teamMember.update({
    where: { id: memberId },
    data: { isActive: false },
  });

  return { id: memberId, removed: true };
}


export async function getAgencyProfile(userId, agentProfile) {
  const user = await loadMembership(userId);
  const plan = user?.membershipPlan;
  const active = user && isMembershipActive(user);
  const boostCredits = await remainingBoostCredits(userId, plan);

  const tier = active
    ? (plan?.planTier === 'PREMIUM'
        ? 'ELITE PARTNER'
        : plan?.planTier === 'MEDIUM'
          ? 'PRO PARTNER'
          : 'BASIC PARTNER')
    : 'FREE';

  return {
    agencyName: agentProfile.agencyName || '',
    reraId: agentProfile.reraAgentId || agentProfile.licenseNumber || '',
    rating: agentProfile.rating || 0,
    reviewCount: agentProfile.totalReviews || 0,
    tier,
    logoUri: agentProfile.agencyLogo || null,
    yearsOfExperience: yearsToExperienceLabel(agentProfile.experience),
    languages: languagesToString(agentProfile.languages),
    specializations: agentProfile.specialization || [],
    website: agentProfile.websiteUrl || '',
    boostCredits,
    membershipLabel: active ? (plan?.name || tierLabelFromPlan(plan, user?.profileType)) : 'Free',
    autoFollowUp: Boolean(agentProfile.autoFollowUpEnabled),
    followUpIntervalDays: agentProfile.followUpIntervalDays,
    serviceAreas: agentProfile.serviceAreas || [],
    isVerified: agentProfile.isVerified,
    verifiedBadge: agentProfile.verifiedBadge,
  };
}

export async function updateAgencyProfile(userId, agentProfile, payload) {
  const data = {};

  if (payload.agencyName !== undefined) data.agencyName = String(payload.agencyName).trim();
  if (payload.reraId !== undefined) {
    data.reraAgentId = String(payload.reraId).trim() || null;
  }
  if (payload.website !== undefined) {
    data.websiteUrl = String(payload.website).trim() || null;
  }
  if (payload.yearsOfExperience !== undefined) {
    data.experience = experienceLabelToYears(payload.yearsOfExperience);
  }
  if (payload.languages !== undefined) {
    data.languages = languagesToArray(payload.languages);
  }
  if (payload.specializations !== undefined) {
    data.specialization = Array.isArray(payload.specializations)
      ? payload.specializations.map((s) => String(s).trim()).filter(Boolean)
      : [];
  }
  if (payload.serviceAreas !== undefined) {
    data.serviceAreas = Array.isArray(payload.serviceAreas)
      ? payload.serviceAreas.map((s) => String(s).trim()).filter(Boolean)
      : [];
  }
  if (payload.autoFollowUp !== undefined) {
    data.autoFollowUpEnabled = Boolean(payload.autoFollowUp);
  }
  if (payload.followUpIntervalDays !== undefined) {
    data.followUpIntervalDays = Math.max(1, Number(payload.followUpIntervalDays) || 3);
  }
  if (payload.logoUri !== undefined) {
    data.agencyLogo = payload.logoUri || null;
  }

  const updated = await prisma.agentProfile.update({
    where: { id: agentProfile.id },
    data,
  });

  return getAgencyProfile(userId, updated);
}
