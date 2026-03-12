import prisma from '../config/database.js';
import { success, error, paginated } from '../utils/response.js';
import { getPagination } from '../utils/pagination.js';
import { uploadToCloudinary } from '../services/cloudinary.service.js';

// ─── Get All Chat Sessions ────────────────────────────────────
export const getChatSessions = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const userId = req.user.id;

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
          AND: [
            { NOT: { isUser1Archived: true, user1Id: userId } },
            { NOT: { isUser2Archived: true, user2Id: userId } },
          ],
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          property: {
            select: {
              id: true, title: true, price: true,
              images: { where: { isPrimary: true }, take: 1, select: { thumbnailUrl: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, messageType: true, createdAt: true, isRead: true, senderId: true },
          },
          user1: { select: { id: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } } },
          user2: { select: { id: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } } },
        },
      }),
      prisma.chatSession.count({
        where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      }),
    ]);

    // Add unread count per session
    const sessionsWithUnread = await Promise.all(
      sessions.map(async (session) => {
        const unreadCount = await prisma.message.count({
          where: {
            sessionId: session.id,
            isRead:    false,
            NOT:       { senderId: userId },
          },
        });
        const otherUser = session.user1Id === userId ? session.user2 : session.user1;
        return { ...session, unreadCount, otherUser };
      })
    );

    return res.json(paginated(sessionsWithUnread, total, page, limit));
  } catch (err) {
    console.error('getChatSessions error:', err);
    return res.status(500).json(error('Failed to fetch chats.'));
  }
};

// ─── Create or Get Chat Session ───────────────────────────────
export const createOrGetSession = async (req, res) => {
  try {
    const { otherUserId, propertyId } = req.body;
    const userId = req.user.id;

    if (otherUserId === userId) {
      return res.status(400).json(error('Cannot chat with yourself.'));
    }

    // Ensure consistent user1/user2 ordering (smaller ID first)
    const [user1Id, user2Id] = [userId, otherUserId].sort();

    const existing = await prisma.chatSession.findUnique({
      where: { user1Id_user2Id_propertyId: { user1Id, user2Id, propertyId: propertyId || null } },
      include: {
        property: { select: { id: true, title: true } },
        user1: { select: { id: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } } },
        user2: { select: { id: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } } },
      },
    });

    if (existing) {
      return res.json(success(existing, 'Chat session found.'));
    }

    // Verify other user exists
    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
    if (!otherUser) return res.status(404).json(error('User not found.'));

    const session = await prisma.chatSession.create({
      data: { user1Id, user2Id, propertyId: propertyId || null },
      include: {
        property: { select: { id: true, title: true } },
        user1: { select: { id: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } } },
        user2: { select: { id: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } } },
      },
    });

    return res.status(201).json(success(session, 'Chat session created.'));
  } catch (err) {
    console.error('createOrGetSession error:', err);
    return res.status(500).json(error('Failed to create chat session.'));
  }
};

// ─── Get Messages ─────────────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page, limit, skip } = getPagination(req.query);
    const userId = req.user.id;

    // Verify user belongs to this session
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
    });
    if (!session) return res.status(404).json(error('Chat session not found.'));

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where:   { sessionId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: { id: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } },
          },
        },
      }),
      prisma.message.count({ where: { sessionId, isDeleted: false } }),
    ]);

    // Mark unread messages as read
    await prisma.message.updateMany({
      where: { sessionId, isRead: false, NOT: { senderId: userId } },
      data:  { isRead: true, readAt: new Date() },
    });

    return res.json(paginated(messages.reverse(), total, page, limit));
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json(error('Failed to fetch messages.'));
  }
};

// ─── Send Message (REST fallback) ────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content, messageType = 'TEXT' } = req.body;
    const userId = req.user.id;

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, OR: [{ user1Id: userId }, { user2Id: userId }] },
    });
    if (!session) return res.status(404).json(error('Chat session not found.'));

    let mediaUrl = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'chat-media',
        messageType === 'IMAGE' ? 'image' : 'video'
      );
      mediaUrl = result.secure_url;
    }

    const message = await prisma.message.create({
      data: {
        sessionId,
        senderId:    userId,
        content:     content || '',
        messageType,
        mediaUrl,
      },
      include: {
        sender: { select: { id: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } } },
      },
    });

    // Update session lastMessageAt
    await prisma.chatSession.update({
      where: { id: sessionId },
      data:  { lastMessageAt: new Date() },
    });

    return res.status(201).json(success(message, 'Message sent.'));
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json(error('Failed to send message.'));
  }
};

// ─── Delete Message ───────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
    if (!message) return res.status(404).json(error('Message not found.'));
    if (message.senderId !== req.user.id) return res.status(403).json(error('Cannot delete others\' messages.'));

    await prisma.message.update({
      where: { id: req.params.messageId },
      data:  { isDeleted: true, deletedAt: new Date(), content: 'This message was deleted.' },
    });

    return res.json(success(null, 'Message deleted.'));
  } catch (err) {
    console.error('deleteMessage error:', err);
    return res.status(500).json(error('Failed to delete message.'));
  }
};

// ─── Archive Chat Session ─────────────────────────────────────
export const archiveSession = async (req, res) => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.sessionId, OR: [{ user1Id: req.user.id }, { user2Id: req.user.id }] },
    });
    if (!session) return res.status(404).json(error('Session not found.'));

    const isUser1 = session.user1Id === req.user.id;
    await prisma.chatSession.update({
      where: { id: session.id },
      data:  isUser1 ? { isUser1Archived: true } : { isUser2Archived: true },
    });

    return res.json(success(null, 'Chat archived.'));
  } catch (err) {
    console.error('archiveSession error:', err);
    return res.status(500).json(error('Failed to archive chat.'));
  }
};

