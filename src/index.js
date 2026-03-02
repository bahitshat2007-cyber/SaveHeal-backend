require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const newsRoutes = require('./routes/news');
const messageRoutes = require('./routes/messages');
const analyticsRoutes = require('./routes/analytics');

const allowedOrigins = [
  'https://saveheal.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Передаём io в routes через app
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'SaveHeal API is running' });
});

// Socket.io — реальный чат
io.on('connection', (socket) => {
  // Клиент присоединяется к своей комнате (userId)
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });

  // Админ присоединяется к комнате админов
  socket.on('join_admin', () => {
    socket.join('admins');
  });

  socket.on('disconnect', () => {});
});

server.listen(PORT, () => {
  console.log(`SaveHeal API запущен на порту ${PORT}`);
});
