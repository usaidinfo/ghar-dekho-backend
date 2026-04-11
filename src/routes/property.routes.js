import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { uploadPropertyImageFiles, handleUploadError } from '../middleware/upload.js';
import {
  getProperties,
  getFeaturedProperties,
  getTrendingAreas,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadPropertyImages,
  deletePropertyImage,
  getMyListings,
  searchProperties,
  getSearchSuggestions,
  getNearbyProperties,
} from '../controllers/property.controller.js';

const router = Router();

// ── Public Routes ─────────────────────────────────────────────

// GET /api/properties           (list + filter + sort + paginate)
router.get('/', optionalAuth, getProperties);

// GET /api/properties/featured
router.get('/featured', getFeaturedProperties);

// GET /api/properties/trending-areas
router.get('/trending-areas', getTrendingAreas);

// GET /api/properties/search?q=...
router.get('/search', optionalAuth, searchProperties);

// GET /api/properties/suggestions?q=...
router.get('/suggestions', getSearchSuggestions);

// GET /api/properties/nearby?lat=...&lng=...
router.get('/nearby', getNearbyProperties);

// GET /api/properties/my-listings  (protected)
router.get('/my-listings', protect, getMyListings);

// GET /api/properties/:id
router.get('/:id', optionalAuth, getPropertyById);

// ── Protected Routes ──────────────────────────────────────────

// POST /api/properties  (create listing)
router.post(
  '/',
  protect,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('propertyType').notEmpty().withMessage('Property type is required'),
    body('listingType').notEmpty().withMessage('Listing type required (BUY/RENT/PG/LEASE)'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required'),
    body('pincode').trim().notEmpty().withMessage('Pincode is required'),
    body('locality').trim().notEmpty().withMessage('Locality is required'),
    body('latitude').isNumeric().withMessage('Latitude is required'),
    body('longitude').isNumeric().withMessage('Longitude is required'),
  ],
  validate,
  createProperty
);

// PUT /api/properties/:id
router.put('/:id', protect, updateProperty);

// DELETE /api/properties/:id
router.delete('/:id', protect, deleteProperty);

// POST /api/properties/:id/images
router.post(
  '/:id/images',
  protect,
  (req, res, next) => {
    uploadPropertyImageFiles(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  uploadPropertyImages
);

// DELETE /api/properties/:id/images/:imageId
router.delete('/:id/images/:imageId', protect, deletePropertyImage);

export default router;

