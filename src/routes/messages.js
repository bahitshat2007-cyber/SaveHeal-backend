const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// POST /api/messages — отправить сообщение (клиент)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { text, isComplain } = req.body;
    const message = await prisma.message.create({
      data: {
        senderId: req.userId,
        text,
        isComplain: isComplain || false,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    // WebSocket: уведомляем админов о новом сообщении
    const io = req.app.get('io');
    io.to('admins').emit('new_message', { message, fromUserId: req.userId });

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

// GET /api/messages/my — мои сообщения (клиент видит свой чат)
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.userId },
          { receiverId: req.userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

// GET /api/messages/users — список пользователей с чатами (админ)
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: 'USER',
        sentMessages: { some: {} },
      },
      select: {
        id: true,
        phone: true,
        name: true,
        sentMessages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { text: true, createdAt: true, isComplain: true },
        },
      },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

// GET /api/messages/user/:userId — чат с конкретным юзером (админ)
router.get('/user/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки чата' });
  }
});

// POST /api/messages/reply/:userId — ответить юзеру (админ)
router.post('/reply/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { text } = req.body;
    const targetUserId = parseInt(req.params.userId);
    const message = await prisma.message.create({
      data: {
        senderId: req.userId,
        receiverId: targetUserId,
        text,
        isComplain: false,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    // WebSocket: уведомляем конкретного клиента о новом ответе
    const io = req.app.get('io');
    io.to(`user_${targetUserId}`).emit('new_reply', message);

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отправки ответа' });
  }
});

// GET /api/messages/complaints — жалобы (админ)
router.get('/complaints', authMiddleware, adminOnly, async (req, res) => {
  try {
    const complaints = await prisma.message.findMany({
      where: { isComplain: true },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { id: true, phone: true, name: true } } },
    });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки жалоб' });
  }
});

module.exports = router;
