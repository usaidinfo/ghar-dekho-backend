import prisma from '../config/database.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(from, days) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function parsePeriodDays(period) {
  const raw = String(period || '30D').toUpperCase();
  if (raw === '7D' || raw === '7') return 7;
  if (raw === '90D' || raw === '90') return 90;
  return 30;
}

/**
 * Owner portfolio analytics for last N days.
 */
export async function getOwnerAnalytics(userId, { period = '30D' } = {}) {
  const days = parsePeriodDays(period);
  const fromDate = addDays(startOfDay(), -days);

  const properties = await prisma.property.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      title: true,
      city: true,
      locality: true,
      status: true,
      price: true,
      listingType: true,
      viewCount: true,
      leadCount: true,
      shareCount: true,
      isBoosted: true,
      isFeatured: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const propertyIds = properties.map((p) => p.id);

  const [dailyRows, perListing] = await Promise.all([
    propertyIds.length
      ? prisma.propertyAnalytics.groupBy({
          by: ['date'],
          where: { propertyId: { in: propertyIds }, date: { gte: fromDate } },
          _sum: {
            views: true,
            leads: true,
            messages: true,
            calls: true,
            wishlistAdds: true,
            shares: true,
            meetings: true,
          },
          orderBy: { date: 'asc' },
        })
      : Promise.resolve([]),
    propertyIds.length
      ? prisma.propertyAnalytics.groupBy({
          by: ['propertyId'],
          where: { propertyId: { in: propertyIds }, date: { gte: fromDate } },
          _sum: {
            views: true,
            leads: true,
            messages: true,
            calls: true,
            wishlistAdds: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const perMap = new Map(
    perListing.map((r) => [
      r.propertyId,
      {
        views: r._sum.views || 0,
        leads: r._sum.leads || 0,
        messages: r._sum.messages || 0,
        calls: r._sum.calls || 0,
        saves: r._sum.wishlistAdds || 0,
      },
    ]),
  );

  const totals = {
    views: 0,
    leads: 0,
    messages: 0,
    calls: 0,
    saves: 0,
    shares: 0,
    meetings: 0,
  };

  for (const row of dailyRows) {
    totals.views += row._sum.views || 0;
    totals.leads += row._sum.leads || 0;
    totals.messages += row._sum.messages || 0;
    totals.calls += row._sum.calls || 0;
    totals.saves += row._sum.wishlistAdds || 0;
    totals.shares += row._sum.shares || 0;
    totals.meetings += row._sum.meetings || 0;
  }

  const series = dailyRows.map((r) => ({
    date: r.date,
    views: r._sum.views || 0,
    leads: r._sum.leads || 0,
    messages: r._sum.messages || 0,
  }));

  const topListings = properties
    .map((p) => {
      const stats = perMap.get(p.id) || {
        views: 0,
        leads: 0,
        messages: 0,
        calls: 0,
        saves: 0,
      };
      return {
        ...p,
        periodStats: stats,
        score: stats.views + stats.leads * 3 + stats.messages * 2,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score, ...rest }) => rest);

  const activeCount = properties.filter((p) => p.status === 'ACTIVE').length;

  return {
    period: `${days}D`,
    listingCount: properties.length,
    activeListings: activeCount,
    totals,
    series,
    topListings,
  };
}
