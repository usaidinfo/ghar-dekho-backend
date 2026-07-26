import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getMyPriceAlerts,
  createOrUpdatePriceAlert,
  removePriceAlert,
  getPropertyPriceAlert,
} from '../controllers/alert.controller.js';

const router = Router();

router.get('/price', protect, getMyPriceAlerts);

router.get('/price/property/:propertyId', protect, getPropertyPriceAlert);

router.post(
  '/price',
  protect,
  [
    body('propertyId').trim().notEmpty().withMessage('propertyId is required'),
    body('targetPrice').isFloat({ gt: 0 }).withMessage('targetPrice must be > 0'),
    body('alertType').optional().isIn(['BELOW', 'ABOVE', 'ANY_DROP']),
  ],
  validate,
  createOrUpdatePriceAlert,
);

router.delete('/price/:id', protect, removePriceAlert);

export default router;
