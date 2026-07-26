import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { requireActiveMembership } from '../middleware/membership.js';
import { getCredits, boostListing, featureListing } from '../controllers/promotion.controller.js';

const router = Router();

// GET /api/promotions/credits
router.get('/credits', protect, getCredits);

// POST /api/promotions/properties/:id/boost
router.post('/properties/:id/boost', protect, requireActiveMembership, boostListing);

// POST /api/promotions/properties/:id/feature
router.post('/properties/:id/feature', protect, requireActiveMembership, featureListing);

export default router;
