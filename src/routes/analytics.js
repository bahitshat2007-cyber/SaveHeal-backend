const express = require('express');
const prisma = require('../lib/prisma');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics — аналитика (админ)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Общая выручка (только оплаченные заказы)
    const paidOrders = await prisma.order.findMany({
      where: { status: { in: ['PAID', 'DELIVERED'] } },
    });
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Всего заказов по статусам
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    // Самые продаваемые товары (по количеству в оплаченных заказах)
    const productSales = {};
    for (const order of paidOrders) {
      const items = order.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          const key = item.productId || item.name;
          if (!productSales[key]) {
            productSales[key] = { name: item.name, totalQty: 0, totalRevenue: 0 };
          }
          productSales[key].totalQty += item.quantity || 1;
          productSales[key].totalRevenue += (item.price || 0) * (item.quantity || 1);
        }
      }
    }
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 10);

    // Всего пользователей
    const totalUsers = await prisma.user.count({ where: { role: 'USER' } });

    // Непрочитанные жалобы
    const totalComplaints = await prisma.message.count({ where: { isComplain: true } });

    // Выручка за последние 7 дней
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = paidOrders.filter(o => new Date(o.createdAt) >= sevenDaysAgo);
    const weekRevenue = recentOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      totalRevenue,
      weekRevenue,
      totalUsers,
      totalComplaints,
      ordersByStatus,
      topProducts,
      totalOrders: paidOrders.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка аналитики' });
  }
});

module.exports = router;
