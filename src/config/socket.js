import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import prisma from './database.js';

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      // React Native/socket.io handshake may not send an Origin header like browsers do.
      // In development, allow all origins so mobile devices can connect.
      origin:      process.env.NODE_ENV === 'development'
        ? true
        : (process.env.FRONTEND_URL || 'http://localhost:3000'),
      credentials: true,
    },
    // Help avoid aggressive disconnects on mobile networks
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const { valid, payload } = verifyToken(token);
      if (!valid) return next(new Error('Invalid token'));

      const user = await prisma.user.findUnique({
        where:  { id: payload.userId },
        select: { id: true, isActive: true, isBanned: true },
      });

      if (!user || !user.isActive || user.isBanned) {
        return next(new Error('Account not authorized'));
      }

      socket.userId = user.id;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.userId}`);
    try {
      socket.conn.on('close', (reason) => {
        console.log(`🔌 Engine close: ${socket.userId}`, { reason });
      });
      socket.conn.on('error', (err) => {
        console.log(`🔌 Engine error: ${socket.userId}`, { message: err?.message });
      });
    } catch {
      // ignore
    }

    // Join personal room (for notifications)
    socket.join(`user:${socket.userId}`);

    // ── Join a chat room ──────────────────────────────────────
    socket.on('chat:join', async (sessionId, ack) => {
      try {
        // Optional server-side membership validation for better debugging
        const s = await prisma.chatSession.findFirst({
          where: { id: sessionId, OR: [{ user1Id: socket.userId }, { user2Id: socket.userId }] },
          select: { id: true },
        });
        if (!s) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Session not found' });
          return;
        }
        socket.join(`chat:${sessionId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Join failed' });
      }
    });

    socket.on('chat:leave', (sessionId) => {
      socket.leave(`chat:${sessionId}`);
    });

    // ── Send message via socket ───────────────────────────────
    socket.on('chat:message', async (data, ack) => {
      try {
        const { sessionId, content, messageType = 'TEXT' } = data;

        // Validate user belongs to session
        const session = await prisma.chatSession.findFirst({
          where: {
            id: sessionId,
            OR: [{ user1Id: socket.userId }, { user2Id: socket.userId }],
          },
        });

        if (!session) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Session not found' });
          return socket.emit('chat:error', { message: 'Session not found' });
        }

        const message = await prisma.message.create({
          data: { sessionId, senderId: socket.userId, content, messageType },
          include: {
            sender: {
              select: {
                id:      true,
                profile: { select: { firstName: true, lastName: true, profileImage: true } },
              },
            },
          },
        });

        await prisma.chatSession.update({
          where: { id: sessionId },
          data:  { lastMessageAt: new Date() },
        });

        // Emit to all in room
        io.to(`chat:${sessionId}`).emit('chat:message', message);

        // Also emit to both users' personal rooms (covers cases where the client isn't joined to chat room yet)
        io.to(`user:${session.user1Id}`).emit('chat:message', message);
        io.to(`user:${session.user2Id}`).emit('chat:message', message);

        // Notify the other user if offline
        const otherId = session.user1Id === socket.userId ? session.user2Id : session.user1Id;
        io.to(`user:${otherId}`).emit('chat:notification', {
          sessionId,
          message: {
            content:     message.content,
            messageType: message.messageType,
            senderId:    socket.userId,
            createdAt:   message.createdAt,
          },
        });
        if (typeof ack === 'function') ack({ ok: true, messageId: message.id });
      } catch (err) {
        console.error('Socket chat:message error:', err);
        socket.emit('chat:error', { message: 'Failed to send message' });
        if (typeof ack === 'function') ack({ ok: false, error: 'Failed to send message' });
      }
    });

    // ── Typing indicators ─────────────────────────────────────
    socket.on('chat:typing', ({ sessionId }) => {
      socket.to(`chat:${sessionId}`).emit('chat:typing', { userId: socket.userId, sessionId });
    });

    socket.on('chat:stop-typing', ({ sessionId }) => {
      socket.to(`chat:${sessionId}`).emit('chat:stop-typing', { userId: socket.userId, sessionId });
    });

    // ── Mark messages as read ─────────────────────────────────
    socket.on('chat:read', async ({ sessionId }) => {
      await prisma.message.updateMany({
        where: { sessionId, isRead: false, NOT: { senderId: socket.userId } },
        data:  { isRead: true, readAt: new Date() },
      });
      socket.to(`chat:${sessionId}`).emit('chat:read', { sessionId, readBy: socket.userId });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${socket.userId}`, { reason });
    });
  });

  return io;
};

