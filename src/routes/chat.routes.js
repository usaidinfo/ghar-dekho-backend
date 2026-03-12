import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import {
  getChatSessions,
  createOrGetSession,
  getMessages,
  sendMessage,
  deleteMessage,
  archiveSession,
} from '../controllers/chat.controller.js';

const router = Router();

router.use(protect);

// GET  /api/chat/sessions
router.get('/sessions', getChatSessions);

// POST /api/chat/sessions
router.post(
  '/sessions',
  [body('otherUserId').notEmpty().withMessage('Other user ID required')],
  validate,
  createOrGetSession
);

// GET  /api/chat/sessions/:sessionId/messages
router.get('/sessions/:sessionId/messages', getMessages);

// POST /api/chat/sessions/:sessionId/messages
router.post(
  '/sessions/:sessionId/messages',
  uploadImage.single('media'),
  [body('content').optional()],
  sendMessage
);

// DELETE /api/chat/sessions/:sessionId/messages/:messageId
router.delete('/sessions/:sessionId/messages/:messageId', deleteMessage);

// PUT /api/chat/sessions/:sessionId/archive
router.put('/sessions/:sessionId/archive', archiveSession);

export default router;

