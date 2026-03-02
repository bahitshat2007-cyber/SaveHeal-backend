const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// POST /api/orders — создать заказ (клиент)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { items, totalAmount, paymentMethod, deliveryName, deliveryPhone, deliveryCity, deliveryAddr, comment } = req.body;

    const order = await prisma.order.create({
      data: {
        userId: req.userId,
        items,
        totalAmount: parseInt(totalAmount),
        paymentMethod: paymentMethod || 'KASPI',
        status: 'PENDING',
        deliveryName,
        deliveryPhone,
        deliveryCity,
        deliveryAddr,
        comment: comment || null,
      },
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания заказа' });
  }
});

// GET /api/orders — мои заказы (клиент)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки заказов' });
  }
});

// GET /api/orders/all — все заказы (админ)
router.get('/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { user: { select: { id: true, phone: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки заказов' });
  }
});

// PUT /api/orders/:id/confirm — подтвердить оплату (админ)
router.put('/:id/confirm', authMiddleware, adminOnly, async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'PAID' },
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка подтверждения' });
  }
});

// PUT /api/orders/:id/deliver — отметить доставленным (админ)
router.put('/:id/deliver', authMiddleware, adminOnly, async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'DELIVERED' },
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// PUT /api/orders/:id/delivery-date — установить дату доставки (админ)
router.put('/:id/delivery-date', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { deliveryDate } = req.body;
    const order = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { deliveryDate },
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка установки даты' });
  }
});

// PUT /api/orders/:id/cancel — отменить заказ (клиент или админ)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    // Клиент может отменить только PENDING заказы
    if (req.userRole !== 'ADMIN' && order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Нельзя отменить заказ после подтверждения оплаты' });
    }

    const cancelReason = req.body.cancelReason || (req.userRole === 'ADMIN' ? 'Отменён администратором' : 'Отменён клиентом');

    const updated = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'CANCELLED', cancelReason },
    });

    // Уведомляем клиента через WebSocket если отменил админ
    if (req.userRole === 'ADMIN') {
      const io = req.app.get('io');
      io.to(`user_${order.userId}`).emit('order_cancelled', {
        orderId: order.id,
        reason: cancelReason,
        totalAmount: order.totalAmount,
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отмены' });
  }
});

module.exports = router;
