import { error } from '../utils/response.js';

export function isMembershipActive(user) {
  if (!user) return false;
  if (user.membershipStatus !== 'ACTIVE') return false;
  if (!user.membershipExpiresAt) return true;
  return new Date(user.membershipExpiresAt).getTime() > Date.now();
}

/**
 * Blocks actions that require paid membership.
 * Use for: property posting, viewing contact info, boosting.
 */
export const requireActiveMembership = (req, res, next) => {
  // Make gating configurable so development/testing isn't blocked.
  // Enable in production by setting ENFORCE_MEMBERSHIP=true.
  const enforce = String(process.env.ENFORCE_MEMBERSHIP || '').toLowerCase() === 'true';
  if (!enforce) return next();

  if (!req.user) {
    return res.status(401).json(error('Please log in first.', null, 'NO_AUTH'));
  }
  if (!isMembershipActive(req.user)) {
    return res.status(402).json(
      error('Membership required. Please upgrade to continue.', { membershipStatus: req.user.membershipStatus }, 'MEMBERSHIP_REQUIRED'),
    );
  }
  next();
};

export function maskPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 2) return '••';
  const last2 = digits.slice(-2);
  return `••••••••${last2}`;
}

