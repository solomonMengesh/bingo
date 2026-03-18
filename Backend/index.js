const dotenv = require('dotenv');
dotenv.config({ quiet: true });

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDb = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const gameRoutes = require('./src/routes/gameRoutes');
const gameStateRoutes = require('./src/routes/gameStateRoutes');
const cartelaRoutes = require('./src/routes/cartelaRoutes');
const paymentMethodRoutes = require('./src/routes/paymentMethodRoutes');
const depositRequestRoutes = require('./src/routes/depositRequestRoutes');
const withdrawalRequestRoutes = require('./src/routes/withdrawalRequestRoutes');
const transactionValidatorRoutes = require('./src/routes/transactionValidatorRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const betRoutes = require('./src/routes/betRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const broadcastRoutes = require('./src/routes/broadcastRoutes');
const maintenanceMode = require('./src/middleware/maintenanceMode');
const { registerGameSocket } = require('./src/realtime/gameSocket');

const app = express();

// CORS: allow requests from your frontend / Telegram mini app origins (required when
// frontend or Telegram is served from ngrok or a different origin than the backend)
const allowedOriginList = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.GAME_WEBAPP_URL, // frontend ngrok/tunnel URL from .env
].filter(Boolean);
const allowedOriginPatterns = [
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/,
  /^https:\/\/[a-z0-9-]+\.ngrok\.io$/,
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin or non-browser (e.g. Postman)
      const fromList = allowedOriginList.includes(origin);
      const fromPattern = allowedOriginPatterns.some((p) => p.test(origin));
      return cb(null, fromList || fromPattern ? origin : false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    credentials: true,
  })
);
app.use(express.json());
app.use(maintenanceMode);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Bingo backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/game', gameStateRoutes);
app.use('/api/cartelas', cartelaRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/deposit-requests', depositRequestRoutes);
app.use('/api/withdrawal-requests', withdrawalRequestRoutes);
app.use('/api/validate-transaction', transactionValidatorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/broadcast', broadcastRoutes);

const PORT = process.env.PORT || 5000;

connectDb()
  .then(async () => {
    const Admin = require('./src/models/Admin');
    const Settings = require('./src/models/Settings');
    const bcrypt = require('bcrypt');
    try {
      const existing = await Admin.countDocuments();
      if (existing === 0) {
        let username = null;
        let passwordHash = null;
        try {
          const settings = await Settings.findOne().lean();
          if (settings?.adminUsername && settings?.adminPasswordHash) {
            username = settings.adminUsername;
            passwordHash = settings.adminPasswordHash;
            console.log('Seed: creating first admin from DB (Settings).');
          }
        } catch (e) {
          console.warn('Seed: could not read Settings', e.message);
        }
        if (!username || !passwordHash) {
          username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
          const password = process.env.ADMIN_PASSWORD || 'admin123';
          if (username) passwordHash = await bcrypt.hash(password, 10);
          console.log('Seed: creating first admin from env/defaults.');
        }
        if (username && passwordHash) {
          await Admin.create({ username, passwordHash });
          console.log('Seed: admin "' + username + '" created. You can log in with this username and your password.');
        }
      } else {
        console.log('Seed: admin(s) already exist, skip.');
      }
    } catch (err) {
      console.error('Seed admin error:', err);
    }
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      },
    });

    registerGameSocket(io);

    server.listen(PORT, () => {
      console.log(`HTTP & Socket.IO server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database', err);
    process.exit(1);
  });

