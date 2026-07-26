import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { requireAgent } from '../middleware/requireAgent.js';
import { validate } from '../middleware/validate.js';
import {
  createTeamMember,
  deleteTeamMember,
  getAgencyProfile,
  getAnalytics,
  getDashboard,
  getLeadById,
  getLeads,
  getListingPerformance,
  getListings,
  getTeam,
  patchAgencyProfile,
  patchLead,
  patchTeamMember,
} from '../controllers/agent.controller.js';

const router = Router();

const agentStack = [protect, requireAgent];

const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'VISIT_SCHEDULED',
  'NEGOTIATION',
  'CONVERTED',
  'LOST',
  'ALL',
];

const LISTING_STATUSES = ['ACTIVE', 'DRAFT', 'SOLD', 'RENTED', 'EXPIRED', 'ALL'];

const TEAM_PERMS = ['ADMIN', 'BILLING', 'EDITOR', 'ANALYTICS', 'VIEWER'];
router.get('/dashboard', ...agentStack, getDashboard);
router.get(
  '/leads',
  ...agentStack,
  [
    query('stage')
      .optional()
      .customSanitizer((v) => String(v).toUpperCase())
      .isIn(LEAD_STAGES)
      .withMessage('Invalid lead stage'),
  ],
  validate,
  getLeads,
);

router.get(
  '/leads/:id',
  ...agentStack,
  [param('id').isUUID().withMessage('Invalid lead id')],
  validate,
  getLeadById,
);

router.patch(
  '/leads/:id',
  ...agentStack,
  [
    param('id').isUUID().withMessage('Invalid lead id'),
    body('stage')
      .optional()
      .customSanitizer((v) => String(v).toUpperCase())
      .isIn(LEAD_STAGES.filter((s) => s !== 'ALL'))
      .withMessage('Invalid stage'),
    body('priority')
      .optional()
      .customSanitizer((v) => String(v).toUpperCase())
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
      .withMessage('Invalid priority'),
    body('notes').optional().isString().isLength({ max: 5000 }),
    body('requirements').optional().isString().isLength({ max: 5000 }),
    body('budget').optional({ nullable: true }).isFloat({ min: 0 }),
    body('followUpAt').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  patchLead,
);
router.get(
  '/listings',
  ...agentStack,
  [
    query('status')
      .optional()
      .customSanitizer((v) => String(v).toUpperCase())
      .isIn(LISTING_STATUSES)
      .withMessage('Invalid listing status'),
  ],
  validate,
  getListings,
);

router.get(
  '/listings/:id/performance',
  ...agentStack,
  [
    param('id').isUUID().withMessage('Invalid listing id'),
    query('period').optional().isString(),
  ],
  validate,
  getListingPerformance,
);
router.get(
  '/analytics',
  ...agentStack,
  [query('period').optional().isString()],
  validate,
  getAnalytics,
);
router.get('/team', ...agentStack, getTeam);

router.post(
  '/team',
  ...agentStack,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('role').optional().trim().isString(),
    body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
    body('phone').optional({ nullable: true }).isString(),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('permissions must be an array'),
    body('permissions.*')
      .optional()
      .customSanitizer((v) => String(v).toUpperCase())
      .isIn(TEAM_PERMS)
      .withMessage('Invalid permission'),
  ],
  validate,
  createTeamMember,
);

router.patch(
  '/team/:id',
  ...agentStack,
  [
    param('id').isUUID().withMessage('Invalid team member id'),
    body('name').optional().trim().notEmpty(),
    body('role').optional().trim().isString(),
    body('email').optional({ nullable: true }).isEmail(),
    body('phone').optional({ nullable: true }).isString(),
    body('isActive').optional().isBoolean(),
    body('permissions').optional().isArray(),
    body('permissions.*')
      .optional()
      .customSanitizer((v) => String(v).toUpperCase())
      .isIn(TEAM_PERMS),
  ],
  validate,
  patchTeamMember,
);

router.delete(
  '/team/:id',
  ...agentStack,
  [param('id').isUUID().withMessage('Invalid team member id')],
  validate,
  deleteTeamMember,
);
router.get('/agency-profile', ...agentStack, getAgencyProfile);

router.patch(
  '/agency-profile',
  ...agentStack,
  [
    body('agencyName').optional().trim().isString().isLength({ max: 200 }),
    body('reraId').optional().trim().isString().isLength({ max: 100 }),
    body('website').optional().trim().isString().isLength({ max: 300 }),
    body('yearsOfExperience')
      .optional()
      .isString()
      .isIn(['0-5 Years', '5-10 Years', '10-15 Years', '15+ Years'])
      .withMessage('Invalid yearsOfExperience'),
    body('languages').optional(),
    body('specializations').optional().isArray(),
    body('specializations.*').optional().isString(),
    body('serviceAreas').optional().isArray(),
    body('autoFollowUp').optional().isBoolean(),
    body('followUpIntervalDays').optional().isInt({ min: 1, max: 30 }),
    body('logoUri').optional({ nullable: true }).isString(),
  ],
  validate,
  patchAgencyProfile,
);

export default router;
