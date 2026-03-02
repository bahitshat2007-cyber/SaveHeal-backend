const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/news — все новости (публичный)
router.get('/', async (req, res) => {
  try {
    const news = await prisma.news.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки новостей' });
  }
});

// POST /api/news — создать новость (админ)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, description, highlightText } = req.body;
    const news = await prisma.news.create({
      data: { title, description, highlightText: highlightText || null },
    });
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка создания новости' });
  }
});

// DELETE /api/news/:id — удалить новость (админ)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await prisma.news.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

module.exports = router;
