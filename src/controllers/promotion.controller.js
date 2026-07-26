import { success, error } from '../utils/response.js';
import {
  getPromotionCredits,
  boostProperty,
  featureProperty,
} from '../services/promotion.service.js';

function sendServiceError(res, err, fallback) {
  const status = err.status || 500;
  return res
    .status(status)
    .json(error(err.message || fallback, err.meta ?? null, err.code || 'SERVER_ERROR'));
}

export const getCredits = async (req, res) => {
  try {
    const data = await getPromotionCredits(req.user.id);
    return res.json(success(data));
  } catch (err) {
    console.error('getCredits error:', err);
    return sendServiceError(res, err, 'Failed to load promotion credits.');
  }
};

export const boostListing = async (req, res) => {
  try {
    const data = await boostProperty(req.user.id, req.params.id);
    return res.status(201).json(success(data, 'Listing boosted successfully.'));
  } catch (err) {
    console.error('boostListing error:', err);
    return sendServiceError(res, err, 'Failed to boost listing.');
  }
};

export const featureListing = async (req, res) => {
  try {
    const data = await featureProperty(req.user.id, req.params.id);
    return res.status(201).json(success(data, 'Listing featured successfully.'));
  } catch (err) {
    console.error('featureListing error:', err);
    return sendServiceError(res, err, 'Failed to feature listing.');
  }
};
