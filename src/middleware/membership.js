import { error } from '../utils/response.js';

export function isMembershipActive(user) {
  if (!user) return false;
  if (user.membershipStatus !== 'ACTIVE') return false;
  if (!user.membershipExpiresAt) return true;
  return new Date(user.membershipExpiresAt).getTime() > Date.now();
}

export const requireActiveMembership = (req, res, next) => {
  const raw = String(process.env.ENFORCE_MEMBERSHIP ?? 'true').toLowerCase();
  const enforce = raw !== 'false' && raw !== '0' && raw !== 'off';
  if (!enforce) return next();

  if (!req.user) {
    return res.status(401).json(error('Please log in first.', null, 'NO_AUTH'));
  }
  if (!isMembershipActive(req.user)) {
    return res.status(402).json(
      error(
        'Membership required. Please upgrade to continue.',
        { membershipStatus: req.user.membershipStatus },
        'MEMBERSHIP_REQUIRED',
      ),
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
