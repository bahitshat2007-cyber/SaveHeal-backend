const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// POST /api/promo/validate — проверить промокод
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Введите промокод' });

    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!promo) return res.status(404).json({ error: 'Промокод не найден' });
    if (!promo.active) return res.status(400).json({ error: 'Промокод больше не активен' });
    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return res.status(400).json({ error: 'Срок промокода истёк' });
    }

    res.json({ discount: promo.discount, code: promo.code });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка проверки промокода' });
  }
});

// POST /api/promo — создать промокод (админ)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { code, discount, expiresAt } = req.body;
    if (!code || !discount) return res.status(400).json({ error: 'Код и скидка обязательны' });

    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        discount: parseInt(discount),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    res.json(promo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Такой промокод уже существует' });
    res.status(500).json({ error: 'Ошибка создания промокода' });
  }
});

// GET /api/promo — все промокоды (админ)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const promos = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(promos);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

// DELETE /api/promo/:id — удалить промокод (админ)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await prisma.promoCode.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

module.exports = router;
