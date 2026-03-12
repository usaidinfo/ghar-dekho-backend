import cloudinary from '../config/cloudinary.js';

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - file buffer from multer
 * @param {string} folder - Cloudinary folder name
 * @param {string} resourceType - 'image' | 'video' | 'raw'
 */
export const uploadToCloudinary = (buffer, folder, resourceType = 'image') =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:         `ghar-dekho/${folder}`,
        resource_type:  resourceType,
        transformation: resourceType === 'image'
          ? [{ quality: 'auto', fetch_format: 'auto' }]
          : undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });

/**
 * Delete a file from Cloudinary by public_id
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

/**
 * Upload multiple image buffers in parallel
 */
export const uploadMultipleImages = async (files, folder) => {
  const results = await Promise.all(
    files.map((file) => uploadToCloudinary(file.buffer, folder, 'image'))
  );
  return results;
};

