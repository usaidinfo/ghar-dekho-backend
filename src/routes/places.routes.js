import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { getNearbyPlaces } from '../controllers/places.controller.js';

const router = Router();

// GET /api/places/nearby?lat=...&lng=...
router.get(
  '/nearby',
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a valid latitude'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be a valid longitude'),
    query('radiusKm').optional().isFloat({ min: 0.5, max: 10 }),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  validate,
  getNearbyPlaces,
);

export default router;
