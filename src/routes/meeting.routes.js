import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import {
  getMyMeetings,
  scheduleMeeting,
  updateMeeting,
  getMeetingById,
} from '../controllers/meeting.controller.js';

const router = Router();

router.use(protect);

// GET  /api/meetings
router.get('/', getMyMeetings);

// GET  /api/meetings/:id
router.get('/:id', getMeetingById);

// POST /api/meetings
router.post(
  '/',
  [
    body('propertyId').notEmpty().withMessage('Property ID required'),
    body('ownerId').notEmpty().withMessage('Owner ID required'),
    body('scheduledAt').isISO8601().withMessage('Valid scheduled date required'),
    body('meetingType').optional().isIn(['IN_PERSON', 'VIDEO_CALL', 'PHONE_CALL']),
  ],
  validate,
  scheduleMeeting
);

// PUT /api/meetings/:id
router.put(
  '/:id',
  [
    body('status').optional().isIn(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW']),
  ],
  validate,
  updateMeeting
);

export default router;

