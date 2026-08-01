/**
 * Creates / upgrades LeadManagement rows when buyers engage with listings.
 * LeadManagement was previously never written — agent leads stayed empty.
 */
import prisma from '../config/database.js';

const STAGE_RANK = {
  NEW: 0,
  CONTACTED: 1,
  INTERESTED: 2,
  VISIT_SCHEDULED: 3,
  NEGOTIATION: 4,
  CONVERTED: 5,
  LOST: -1,
  NOT_INTERESTED: -1,
};

/**
 * @param {object} opts
 * @param {string} opts.propertyId
 * @param {string} opts.buyerId
 * @param {string} [opts.source] LeadSource enum
 * @param {string} [opts.status] LeadStatus enum
 * @param {string} [opts.notes]
 * @param {Date|string|null} [opts.followUpAt]
 * @param {string} [opts.requirements]
 */
export async function upsertPropertyLead({
  propertyId,
  buyerId,
  source = 'DIRECT',
  status = 'NEW',
  notes,
  followUpAt,
  requirements,
}) {
  if (!propertyId || !buyerId) return null;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, agentId: true, title: true },
  });
  if (!property) return null;

  // Don't create leads for the owner's / listing agent's own views
  if (buyerId === property.ownerId || buyerId === property.agentId) {
    return null;
  }

  const agentUserIds = [property.agentId, property.ownerId].filter(Boolean);
  const agentProfiles = await prisma.agentProfile.findMany({
    where: { userId: { in: agentUserIds } },
    select: { id: true, userId: true },
  });
  const agentProfileId =
    agentProfiles.find((a) => a.userId === property.agentId)?.id ||
    agentProfiles.find((a) => a.userId === property.ownerId)?.id ||
    null;

  const existing = await prisma.leadManagement.findFirst({
    where: { propertyId, buyerId },
    orderBy: { createdAt: 'desc' },
  });

  const nextStatus = String(status).toUpperCase();
  const nextSource = String(source).toUpperCase();

  if (!existing) {
    const created = await prisma.leadManagement.create({
      data: {
        propertyId,
        buyerId,
        ownerId: property.ownerId,
        agentId: agentProfileId,
        source: nextSource,
        status: nextStatus,
        notes: notes || null,
        requirements: requirements || null,
        followUpAt: followUpAt ? new Date(followUpAt) : null,
        lastContactAt: nextStatus !== 'NEW' ? new Date() : null,
        priority: nextStatus === 'VISIT_SCHEDULED' ? 'HIGH' : 'MEDIUM',
      },
    });

    if (agentProfileId) {
      await prisma.agentProfile
        .update({
          where: { id: agentProfileId },
          data: { totalLeads: { increment: 1 } },
        })
        .catch(() => {});
    }

    return created;
  }

  const data = {};
  const currentRank = STAGE_RANK[existing.status] ?? 0;
  const nextRank = STAGE_RANK[nextStatus] ?? 0;

  // Upgrade stage only (never downgrade active pipeline; allow LOST only if explicit)
  if (nextRank > currentRank || (nextRank < 0 && currentRank >= 0 && nextStatus === 'LOST')) {
    data.status = nextStatus;
    if (nextStatus === 'CONVERTED') data.convertedAt = new Date();
  }

  if (notes) data.notes = notes;
  if (requirements) data.requirements = requirements;
  if (followUpAt) data.followUpAt = new Date(followUpAt);
  if (nextStatus !== 'NEW') data.lastContactAt = new Date();
  if (nextStatus === 'VISIT_SCHEDULED' && existing.priority === 'MEDIUM') {
    data.priority = 'HIGH';
  }

  if (Object.keys(data).length === 0) return existing;

  return prisma.leadManagement.update({
    where: { id: existing.id },
    data,
  });
}
