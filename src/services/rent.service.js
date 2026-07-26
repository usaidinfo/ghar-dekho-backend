import prisma from '../config/database.js';

function httpError(message, status = 400, code = 'BAD_REQUEST', meta = null) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.meta = meta;
  return err;
}

function nextSendForDueDay(dueDate) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = Math.min(Math.max(1, dueDate), 28);
  let next = new Date(y, m, day, 9, 0, 0, 0);
  if (next <= now) {
    next = new Date(y, m + 1, day, 9, 0, 0, 0);
  }
  return next;
}

export async function listRentReminders(userId) {
  return prisma.rentReminder.findMany({
    where: { userId },
    orderBy: [{ isActive: 'desc' }, { dueDate: 'asc' }],
  });
}

export async function createRentReminder(userId, body) {
  const amount = Number(body.amount);
  const dueDate = Number(body.dueDate);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw httpError('Enter a valid rent amount.', 400, 'INVALID_AMOUNT');
  }
  if (!Number.isInteger(dueDate) || dueDate < 1 || dueDate > 31) {
    throw httpError('dueDate must be a day of month between 1 and 31.', 400, 'INVALID_DUE_DATE');
  }

  let propertyId = body.propertyId ? String(body.propertyId) : null;
  if (propertyId) {
    const owned = await prisma.property.findFirst({
      where: { id: propertyId, ownerId: userId },
      select: { id: true },
    });
    if (!owned) throw httpError('Property not found in your listings.', 404, 'NOT_FOUND');
  }

  return prisma.rentReminder.create({
    data: {
      userId,
      propertyId,
      tenantName: body.tenantName ? String(body.tenantName).trim() : null,
      amount,
      dueDate,
      message: body.message ? String(body.message).trim() : null,
      isActive: true,
      nextSendAt: nextSendForDueDay(dueDate),
    },
  });
}

export async function updateRentReminder(userId, id, body) {
  const existing = await prisma.rentReminder.findFirst({ where: { id, userId } });
  if (!existing) throw httpError('Reminder not found.', 404, 'NOT_FOUND');

  const data = {};
  if (body.tenantName !== undefined) data.tenantName = body.tenantName ? String(body.tenantName).trim() : null;
  if (body.message !== undefined) data.message = body.message ? String(body.message).trim() : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw httpError('Enter a valid rent amount.', 400, 'INVALID_AMOUNT');
    }
    data.amount = amount;
  }
  if (body.dueDate !== undefined) {
    const dueDate = Number(body.dueDate);
    if (!Number.isInteger(dueDate) || dueDate < 1 || dueDate > 31) {
      throw httpError('dueDate must be between 1 and 31.', 400, 'INVALID_DUE_DATE');
    }
    data.dueDate = dueDate;
    data.nextSendAt = nextSendForDueDay(dueDate);
  }

  return prisma.rentReminder.update({ where: { id }, data });
}

export async function deleteRentReminder(userId, id) {
  const existing = await prisma.rentReminder.findFirst({ where: { id, userId } });
  if (!existing) throw httpError('Reminder not found.', 404, 'NOT_FOUND');
  await prisma.rentReminder.delete({ where: { id } });
  return { id };
}
