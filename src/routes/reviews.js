const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/:productId — отзывы на товар
router.get('/:productId', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: parseInt(req.params.productId) },
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки отзывов' });
  }
});

// POST /api/reviews/:productId — оставить отзыв
router.post('/:productId', authMiddleware, async (req, res) => {
  try {
    const { rating, text } = req.body;
    if (!rating || !text) return res.status(400).json({ error: 'Заполните все поля' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Рейтинг от 1 до 5' });

    // Проверяем что юзер ещё не оставлял отзыв
    const existing = await prisma.review.findFirst({
      where: { userId: req.userId, productId: parseInt(req.params.productId) },
    });
    if (existing) return res.status(400).json({ error: 'Вы уже оставляли отзыв на этот товар' });

    const review = await prisma.review.create({
      data: {
        userId: req.userId,
        productId: parseInt(req.params.productId),
        rating: parseInt(rating),
        text,
      },
      include: { user: { select: { name: true, phone: true } } },
    });
    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отправки отзыва' });
  }
});

module.exports = router;
