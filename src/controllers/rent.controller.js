import { success, error } from '../utils/response.js';
import {
  listRentReminders,
  createRentReminder,
  updateRentReminder,
  deleteRentReminder,
} from '../services/rent.service.js';

function sendErr(res, err, fallback) {
  return res
    .status(err.status || 500)
    .json(error(err.message || fallback, err.meta ?? null, err.code || 'SERVER_ERROR'));
}

export const getRentReminders = async (req, res) => {
  try {
    const data = await listRentReminders(req.user.id);
    return res.json(success(data));
  } catch (err) {
    console.error('getRentReminders error:', err);
    return sendErr(res, err, 'Failed to load rent reminders.');
  }
};

export const postRentReminder = async (req, res) => {
  try {
    const data = await createRentReminder(req.user.id, req.body);
    return res.status(201).json(success(data, 'Rent reminder created.'));
  } catch (err) {
    console.error('postRentReminder error:', err);
    return sendErr(res, err, 'Failed to create reminder.');
  }
};

export const patchRentReminder = async (req, res) => {
  try {
    const data = await updateRentReminder(req.user.id, req.params.id, req.body);
    return res.json(success(data, 'Reminder updated.'));
  } catch (err) {
    console.error('patchRentReminder error:', err);
    return sendErr(res, err, 'Failed to update reminder.');
  }
};

export const removeRentReminder = async (req, res) => {
  try {
    const data = await deleteRentReminder(req.user.id, req.params.id);
    return res.json(success(data, 'Reminder deleted.'));
  } catch (err) {
    console.error('removeRentReminder error:', err);
    return sendErr(res, err, 'Failed to delete reminder.');
  }
};
