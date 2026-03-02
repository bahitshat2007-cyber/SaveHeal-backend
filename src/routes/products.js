const express = require('express');
const multer = require('multer');
const cloudinary = require('../lib/cloudinary');
const prisma = require('../lib/prisma');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Загрузка картинки в Cloudinary из буфера
async function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'saveheal', quality: 'auto', fetch_format: 'auto' },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// GET /api/products — все товары (публичный)
router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки товаров' });
  }
});

// GET /api/products/:id — один товар (публичный)
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/products — создать товар (админ)
router.post('/', authMiddleware, adminOnly, upload.array('images', 5), async (req, res) => {
  try {
    const { name, price, weight, description, ingredients, proteins, fats, carbs, calories } = req.body;

    // Загружаем все изображения в Cloudinary
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer);
        imageUrls.push(url);
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        price: parseInt(price),
        weight,
        description,
        ingredients,
        proteins: parseFloat(proteins),
        fats: parseFloat(fats),
        carbs: parseFloat(carbs),
        calories: parseFloat(calories),
        images: imageUrls,
      },
    });

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания товара' });
  }
});

// PUT /api/products/:id — обновить товар (админ)
router.put('/:id', authMiddleware, adminOnly, upload.array('images', 5), async (req, res) => {
  try {
    const { name, price, weight, description, ingredients, proteins, fats, carbs, calories, existingImages } = req.body;

    let imageUrls = existingImages ? JSON.parse(existingImages) : [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer);
        imageUrls.push(url);
      }
    }

    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        price: parseInt(price),
        weight,
        description,
        ingredients,
        proteins: parseFloat(proteins),
        fats: parseFloat(fats),
        carbs: parseFloat(carbs),
        calories: parseFloat(calories),
        images: imageUrls,
      },
    });

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления товара' });
  }
});

// DELETE /api/products/:id — удалить товар (админ)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления товара' });
  }
});

module.exports = router;
