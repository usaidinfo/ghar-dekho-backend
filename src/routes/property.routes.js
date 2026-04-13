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
  // Allow multipart create with optional `images[]` in the same request
  (req, res, next) => {
    uploadPropertyImageFiles(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  (req, res, next) => {
    // Helpful diagnostics for mobile multipart issues
    try {
      const ct = req.headers['content-type'];
      const filesCount = Array.isArray(req.files) ? req.files.length : 0;
      const keys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];
      console.log('POST /api/properties', { contentType: ct, filesCount, bodyKeys: keys.slice(0, 20) });
    } catch {
      // ignore
    }
    next();
  },
  [
    body('status').optional().isIn([
      'DRAFT', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED',
      'UNDER_VERIFICATION', 'REJECTED', 'EXPIRED',
    ]),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').custom((value, { req }) => {
      if (req.body?.status === 'DRAFT') return true;
      if (value == null || !String(value).trim()) throw new Error('Description is required');
      return true;
    }),
    body('propertyType').notEmpty().withMessage('Property type is required'),
    body('listingType').notEmpty().withMessage('Listing type required (BUY/RENT/PG/LEASE)'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('address').custom((value, { req }) => {
      if (req.body?.status === 'DRAFT') return true;
      if (value == null || !String(value).trim()) throw new Error('Address is required');
      return true;
    }),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required'),
    body('pincode').trim().notEmpty().withMessage('Pincode is required'),
    body('locality').trim().notEmpty().withMessage('Locality is required'),
    body('latitude').custom((value, { req }) => {
      if (req.body?.status === 'DRAFT') return true;
      if (value === undefined || value === null || value === '' || Number.isNaN(Number(value))) {
        throw new Error('Latitude is required');
      }
      return true;
    }),
    body('longitude').custom((value, { req }) => {
      if (req.body?.status === 'DRAFT') return true;
      if (value === undefined || value === null || value === '' || Number.isNaN(Number(value))) {
        throw new Error('Longitude is required');
      }
      return true;
    }),
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

