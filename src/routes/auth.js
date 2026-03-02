const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register — регистрация по телефону или email
router.post('/register', async (req, res) => {
  try {
    const { phone, email, name, password } = req.body;
    if ((!phone && !email) || !password) {
      return res.status(400).json({ error: 'Телефон/Email и пароль обязательны' });
    }

    const identifier = email ? { email } : { phone };
    const existing = await prisma.user.findFirst({ where: identifier });
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с такими данными уже существует' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { phone, email, name: name || null, password: hashed },
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/login — вход по телефону или email
router.post('/login', async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    const identifier = email ? { email } : { phone };
    
    if (!email && !phone) return res.status(400).json({ error: 'Укажите телефон или email' });
    
    const user = await prisma.user.findFirst({ where: identifier });
    if (!user || !user.password) return res.status(400).json({ error: 'Неверные данные или пароль' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Неверные данные или пароль' });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/google — вход через Google
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Нет токена Google' });

    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Ищем пользователя по googleId или email
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      // Обновляем googleId если вошли через email который уже есть
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, name: user.name || name },
        });
      }
    } else {
      // Создаём нового пользователя
      user = await prisma.user.create({
        data: { googleId, email, name },
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: 'Ошибка авторизации через Google' });
  }
});

// GET /api/auth/me — текущий пользователь
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, phone: true, email: true, name: true, role: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
