import { success, error } from '../utils/response.js';
import {
  activateMembership,
  formatMembershipPayload,
  listMembershipPlans,
  loadUserMembershipContext,
} from '../services/membership.service.js';

const VALID_ACCOUNT_TYPES = ['OWNER', 'BROKER', 'BUILDER'];
const VALID_PLAN_TIERS = ['BASIC', 'MEDIUM', 'PREMIUM'];

function demoActivationAllowed() {
  const env = String(process.env.NODE_ENV || 'development').toLowerCase();
  if (env === 'production') {
    return String(process.env.ALLOW_DEMO_MEMBERSHIP || '').toLowerCase() === 'true';
  }
  return String(process.env.ALLOW_DEMO_MEMBERSHIP || 'true').toLowerCase() !== 'false';
}

/** GET /api/membership/plans?accountType=OWNER */
export const getMembershipPlans = async (req, res) => {
  try {
    const { accountType } = req.query;
    if (accountType && !VALID_ACCOUNT_TYPES.includes(String(accountType).toUpperCase())) {
      return res.status(400).json(error('Invalid accountType.'));
    }

    const plans = await listMembershipPlans(
      accountType ? String(accountType).toUpperCase() : null,
    );

    return res.json(success(plans));
  } catch (err) {
    console.error('getMembershipPlans error:', err);
    return res.status(500).json(error('Failed to fetch membership plans.'));
  }
};

/** GET /api/membership/status */
export const getMembershipStatus = async (req, res) => {
  try {
    const ctx = await loadUserMembershipContext(req.user.id);
    return res.json(success(formatMembershipPayload(ctx)));
  } catch (err) {
    console.error('getMembershipStatus error:', err);
    return res.status(500).json(error('Failed to fetch membership status.'));
  }
};

/** POST /api/membership/activate-demo — dev/demo checkout without Razorpay */
export const activateDemoMembership = async (req, res) => {
  try {
    if (!demoActivationAllowed()) {
      return res.status(403).json(error('Demo membership activation is disabled.', null, 'FORBIDDEN'));
    }

    const accountType = String(req.body.accountType || '').toUpperCase();
    const planTier = String(req.body.planTier || '').toUpperCase();

    if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
      return res.status(400).json(error('accountType must be OWNER, BROKER, or BUILDER.'));
    }
    if (!VALID_PLAN_TIERS.includes(planTier)) {
      return res.status(400).json(error('planTier must be BASIC, MEDIUM, or PREMIUM.'));
    }

    const result = await activateMembership({
      userId: req.user.id,
      accountType,
      planTier,
      source: 'DEMO',
    });

    const ctx = await loadUserMembershipContext(req.user.id);

    return res.json(
      success(
        {
          ...formatMembershipPayload(ctx),
          subscriptionId: result.subscription.id,
        },
        'Membership activated successfully.',
      ),
    );
  } catch (err) {
    console.error('activateDemoMembership error:', err);
    if (err.code === 'PLAN_NOT_FOUND') {
      return res.status(404).json(error(err.message, null, err.code));
    }
    return res.status(err.status || 500).json(error(err.message || 'Failed to activate membership.'));
  }
};

/** POST /api/membership/renew-demo — extend current plan (demo) */
export const renewDemoMembership = async (req, res) => {
  try {
    if (!demoActivationAllowed()) {
      return res.status(403).json(error('Demo membership renewal is disabled.', null, 'FORBIDDEN'));
    }

    const ctx = await loadUserMembershipContext(req.user.id);
    const plan = ctx?.user?.membershipPlan;
    if (!plan?.accountType || !plan?.planTier) {
      return res.status(400).json(error('No active plan to renew. Choose a plan first.'));
    }

    const result = await activateMembership({
      userId: req.user.id,
      accountType: plan.accountType,
      planTier: plan.planTier,
      source: 'DEMO_RENEW',
    });

    const refreshed = await loadUserMembershipContext(req.user.id);

    return res.json(
      success(
        {
          ...formatMembershipPayload(refreshed),
          subscriptionId: result.subscription.id,
        },
        'Membership renewed successfully.',
      ),
    );
  } catch (err) {
    console.error('renewDemoMembership error:', err);
    return res.status(err.status || 500).json(error(err.message || 'Failed to renew membership.'));
  }
};
