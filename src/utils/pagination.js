/**
 * Parse and validate pagination params from query string
 */
export const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page  || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Parse sort options for properties
 * sort=price_asc | price_desc | newest | popular | verified
 */
export const getPropertySort = (sortParam = 'newest') => {
  const sorts = {
    price_asc:  { price: 'asc' },
    price_desc: { price: 'desc' },
    newest:     { postedAt: 'desc' },
    oldest:     { postedAt: 'asc' },
    popular:    { popularityScore: 'desc' },
    verified:   { isVerified: 'desc' },
    most_viewed:{ viewCount: 'desc' },
  };
  return sorts[sortParam] || sorts.newest;
};

