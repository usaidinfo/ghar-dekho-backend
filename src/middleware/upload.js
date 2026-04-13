import multer from 'multer';
import { error } from '../utils/response.js';

// Use memory storage — files go to Cloudinary directly from buffer
const storage = multer.memoryStorage();

const fileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`), false);
  }
};

// Image upload — allow any image/* (Android/iOS often send vendor-specific subtypes)
const imageMimeFilter = (req, file, cb) => {
  const m = (file.mimetype || '').toLowerCase();
  if (m.startsWith('image/')) return cb(null, true);
  cb(new Error('Invalid file type. Please choose an image.'), false);
};

export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: imageMimeFilter,
});

// Video upload (MP4, MOV, WebM)
export const uploadVideo = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: fileFilter(['video/mp4', 'video/quicktime', 'video/webm']),
});

// Document upload (PDF)
export const uploadDocument = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: fileFilter(['application/pdf', 'image/jpeg', 'image/png']),
});

// Multiple images (up to 20) — field name must be `images`
export const uploadMultipleImages = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
}).array('images', 20);

// Property image upload: any file field name (images, file, photo, etc.) — max 20 files total
export const uploadPropertyImageFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: imageMimeFilter,
}).any();

// Multer error handler middleware
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json(error('File too large. Max size exceeded.'));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json(error('Too many files. Max 20 images allowed.'));
    }
    return res.status(400).json(error(err.message));
  }
  if (err) {
    return res.status(400).json(error(err.message));
  }
  next();
};

