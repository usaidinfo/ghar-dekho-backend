import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getRentReminders,
  postRentReminder,
  patchRentReminder,
  removeRentReminder,
} from '../controllers/rent.controller.js';

const router = Router();

router.get('/reminders', protect, getRentReminders);

router.post(
  '/reminders',
  protect,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be > 0'),
    body('dueDate').isInt({ min: 1, max: 31 }).withMessage('dueDate must be 1–31'),
    body('tenantName').optional().isString(),
    body('propertyId').optional().isString(),
    body('message').optional().isString(),
  ],
  validate,
  postRentReminder,
);

router.patch('/reminders/:id', protect, patchRentReminder);

router.delete('/reminders/:id', protect, removeRentReminder);

export default router;
