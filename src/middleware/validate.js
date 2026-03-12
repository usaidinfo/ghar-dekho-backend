import { validationResult } from 'express-validator';
import { error } from '../utils/response.js';

/**
 * Run express-validator checks and return 422 on failure
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field:   e.path,
      message: e.msg,
    }));
    return res.status(422).json(error('Validation failed.', formatted, 'VALIDATION_ERROR'));
  }
  next();
};

