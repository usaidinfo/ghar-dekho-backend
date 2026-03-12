/**
 * Standard API response helpers
 * Usage: return res.json(success(data, 'Created')) or res.status(400).json(error('Bad request'))
 */

export const success = (data = null, message = 'Success', meta = null) => ({
  success: true,
  message,
  data,
  ...(meta && { meta }),
});

export const error = (message = 'Something went wrong', errors = null, code = null) => ({
  success: false,
  message,
  ...(errors && { errors }),
  ...(code   && { code }),
});

export const paginated = (data, total, page, limit) => ({
  success: true,
  data,
  meta: {
    total,
    page:       Number(page),
    limit:      Number(limit),
    totalPages: Math.ceil(total / limit),
    hasNext:    page * limit < total,
    hasPrev:    page > 1,
  },
});

