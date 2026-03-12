import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist,
  getComparisons,
  addToCompare,
  removeFromCompare,
} from '../controllers/wishlist.controller.js';

const router = Router();

// All wishlist & compare routes require auth
router.use(protect);

// GET  /api/wishlist
router.get('/', getWishlist);

// POST /api/wishlist
router.post(
  '/',
  [body('propertyId').notEmpty().withMessage('Property ID required')],
  validate,
  addToWishlist
);

// DELETE /api/wishlist/:propertyId
router.delete('/:propertyId', removeFromWishlist);

// GET  /api/wishlist/check/:propertyId
router.get('/check/:propertyId', checkWishlist);

// GET  /api/wishlist/compare
router.get('/compare/list', getComparisons);

// POST /api/wishlist/compare
router.post(
  '/compare',
  [body('propertyId').notEmpty().withMessage('Property ID required')],
  validate,
  addToCompare
);

// DELETE /api/wishlist/compare/:comparisonId/:propertyId
router.delete('/compare/:comparisonId/:propertyId', removeFromCompare);

export default router;

