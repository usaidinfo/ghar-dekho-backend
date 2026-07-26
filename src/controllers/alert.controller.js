import { success, error } from '../utils/response.js';
import {
  listPriceAlerts,
  upsertPriceAlert,
  deletePriceAlert,
  getPriceAlertForProperty,
} from '../services/alert.service.js';

function sendErr(res, err, fallback) {
  return res
    .status(err.status || 500)
    .json(error(err.message || fallback, err.meta ?? null, err.code || 'SERVER_ERROR'));
}

export const getMyPriceAlerts = async (req, res) => {
  try {
    const data = await listPriceAlerts(req.user.id);
    return res.json(success(data));
  } catch (err) {
    console.error('getMyPriceAlerts error:', err);
    return sendErr(res, err, 'Failed to load alerts.');
  }
};

export const createOrUpdatePriceAlert = async (req, res) => {
  try {
    const data = await upsertPriceAlert(req.user.id, req.body);
    return res.status(201).json(success(data, 'Price alert saved.'));
  } catch (err) {
    console.error('createOrUpdatePriceAlert error:', err);
    return sendErr(res, err, 'Failed to save alert.');
  }
};

export const removePriceAlert = async (req, res) => {
  try {
    const data = await deletePriceAlert(req.user.id, req.params.id);
    return res.json(success(data, 'Alert removed.'));
  } catch (err) {
    console.error('removePriceAlert error:', err);
    return sendErr(res, err, 'Failed to remove alert.');
  }
};

export const getPropertyPriceAlert = async (req, res) => {
  try {
    const data = await getPriceAlertForProperty(req.user.id, req.params.propertyId);
    return res.json(success(data));
  } catch (err) {
    console.error('getPropertyPriceAlert error:', err);
    return sendErr(res, err, 'Failed to load alert.');
  }
};
