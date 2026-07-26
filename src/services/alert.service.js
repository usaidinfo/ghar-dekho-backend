import prisma from '../config/database.js';

function httpError(message, status = 400, code = 'BAD_REQUEST', meta = null) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.meta = meta;
  return err;
}

export async function listPriceAlerts(userId) {
  return prisma.priceAlert.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          price: true,
          city: true,
          locality: true,
          listingType: true,
          images: {
            take: 1,
            orderBy: { order: 'asc' },
            select: { imageUrl: true, thumbnailUrl: true },
          },
        },
      },
    },
  });
}

export async function upsertPriceAlert(userId, { propertyId, targetPrice, alertType = 'BELOW' }) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, price: true, title: true },
  });
  if (!property) throw httpError('Property not found.', 404, 'NOT_FOUND');

  const price = Number(targetPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw httpError('Enter a valid target price.', 400, 'INVALID_PRICE');
  }

  const type = String(alertType || 'BELOW').toUpperCase();
  if (!['BELOW', 'ABOVE', 'ANY_DROP'].includes(type)) {
    throw httpError('Invalid alert type.', 400, 'INVALID_TYPE');
  }

  return prisma.priceAlert.upsert({
    where: {
      userId_propertyId: { userId, propertyId },
    },
    update: {
      targetPrice: price,
      alertType: type,
      isActive: true,
      triggeredAt: null,
    },
    create: {
      userId,
      propertyId,
      targetPrice: price,
      alertType: type,
      isActive: true,
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          price: true,
          city: true,
          locality: true,
        },
      },
    },
  });
}

export async function deletePriceAlert(userId, alertId) {
  const existing = await prisma.priceAlert.findFirst({
    where: { id: alertId, userId },
  });
  if (!existing) throw httpError('Alert not found.', 404, 'NOT_FOUND');

  await prisma.priceAlert.delete({ where: { id: alertId } });
  return { id: alertId };
}

export async function getPriceAlertForProperty(userId, propertyId) {
  return prisma.priceAlert.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
  });
}
