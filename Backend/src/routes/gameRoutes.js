const express = require('express');
const Game = require('../models/Game');
const { generateCartelaPool } = require('../utils/cartelaGenerator');

const MAX_CARTELAS_PER_PLAYER = 4;
const MIN_CARTELA_POOL_SIZE = 50;
const MAX_CARTELA_POOL_SIZE = 2000;

const router = express.Router();

// POST /api/games
// Body: { stakeEtb, playerLimit, platformFeePercent, timerDurationSeconds?, playerCount?, scheduledStartAt? (ISO date) }
router.post('/', async (req, res) => {
  try {
    const {
      stakeEtb,
      playerLimit,
      platformFeePercent,
      timerDurationSeconds,
      playerCount,
      scheduledStartAt,
    } = req.body || {};

    if (
      stakeEtb == null ||
      playerLimit == null ||
      platformFeePercent == null
    ) {
      return res
        .status(400)
        .json({ message: 'stakeEtb, playerLimit, and platformFeePercent are required' });
    }

    if (Number(stakeEtb) <= 0 || Number(playerLimit) <= 0) {
      return res
        .status(400)
        .json({ message: 'stakeEtb and playerLimit must be positive numbers' });
    }

    if (Number(platformFeePercent) < 0 || Number(platformFeePercent) > 100) {
      return res
        .status(400)
        .json({ message: 'platformFeePercent must be between 0 and 100' });
    }

    const timerSeconds =
      timerDurationSeconds != null ? Number(timerDurationSeconds) : 60;
    if (Number.isNaN(timerSeconds) || timerSeconds <= 0) {
      return res
        .status(400)
        .json({ message: 'timerDurationSeconds must be a positive number of seconds' });
    }

    const initialPlayerCount =
      playerCount != null ? Number(playerCount) : 0;
    if (Number.isNaN(initialPlayerCount) || initialPlayerCount < 0) {
      return res
        .status(400)
        .json({ message: 'playerCount must be a non-negative number' });
    }

    const requestedPoolSize = Number(req.body?.cartelaPoolSize);
    const derivedPoolSize = Number(playerLimit) * MAX_CARTELAS_PER_PLAYER;
    const basePoolSize = !Number.isNaN(requestedPoolSize) && requestedPoolSize > 0
      ? requestedPoolSize
      : derivedPoolSize;
    const poolSize = Math.min(
      MAX_CARTELA_POOL_SIZE,
      Math.max(MIN_CARTELA_POOL_SIZE, basePoolSize)
    );

    const grids = generateCartelaPool(poolSize);
    const cartelaPool = grids.map((numbers, idx) => ({ cartelaId: idx + 1, numbers }));

    const cartelaLimit = poolSize;
    const cartelas = Array.from({ length: cartelaLimit }, (_, idx) => ({
      cartelaNumber: idx + 1,
      selected: false,
      selectedBy: null,
    }));

    const startAt = scheduledStartAt
      ? (typeof scheduledStartAt === 'string' ? new Date(scheduledStartAt) : scheduledStartAt)
      : null;
    if (startAt && Number.isNaN(startAt.getTime())) {
      return res.status(400).json({ message: 'scheduledStartAt must be a valid ISO date string' });
    }

    await Game.updateMany({}, { $set: { isActive: false } });
    const game = await Game.create({
      stakeEtb: Number(stakeEtb),
      playerLimit: Number(playerLimit),
      platformFeePercent: Number(platformFeePercent),
      status: 'scheduled',
      scheduledStartAt: startAt || undefined,
      isActive: true,
      playerCount: initialPlayerCount,
      cartelaPool,
      roundSelections: [],
      cartelas,
      currentRoundNumber: 1,
      roundStatus: 'cartela_selection',
      calledNumbers: [],
    });

    return res.status(201).json({ game });
  } catch (err) {
    console.error('Error creating game', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/games/:id/winners
// Body: { winnerUserIds: [userId1, userId2, ...] }
// This sets the winners for a completed game so that the prize
// calculation logic (used by the realtime timer) can split payouts.
router.post('/:id/winners', async (req, res) => {
  try {
    const { id } = req.params;
    const { winnerUserIds } = req.body || {};

    if (!Array.isArray(winnerUserIds) || winnerUserIds.length === 0) {
      return res.status(400).json({ message: 'winnerUserIds must be a non-empty array' });
    }

    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    game.winners = winnerUserIds;
    await game.save();

    return res.status(200).json({ game });
  } catch (err) {
    console.error('Error setting game winners', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// List games for lobby / admin
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status) {
      const list = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length > 0) {
        query.status = { $in: list };
      }
    }

    const games = await Game.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ games });
  } catch (err) {
    console.error('Error listing games', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/games/:id — update game fields (e.g. scheduledStartAt)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledStartAt } = req.body || {};
    const game = await Game.findById(id);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (scheduledStartAt !== undefined) {
      const d = typeof scheduledStartAt === 'string' ? new Date(scheduledStartAt) : scheduledStartAt;
      if (d && !Number.isNaN(d.getTime())) {
        game.scheduledStartAt = d;
      } else if (scheduledStartAt === null || scheduledStartAt === '') {
        game.scheduledStartAt = null;
      }
    }
    await game.save();
    return res.status(200).json({ game });
  } catch (err) {
    console.error('Error updating game', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/games/:id/status  { status: 'running' | 'stopped' } — admin start/stop
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowedStatuses = ['scheduled', 'running', 'stopped'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value', allowed: allowedStatuses });
    }

    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const from = String(game.status || 'scheduled');
    if (from === status) {
      return res.status(200).json({ game });
    }
    if (status === 'stopped') {
      game.status = 'stopped';
      await game.save();
      const { clearTimersForGame } = require('../realtime/gameSocket');
      if (typeof clearTimersForGame === 'function') clearTimersForGame(id);
      return res.status(200).json({ game });
    }
    // Allow scheduled or open (legacy) -> running
    if (status === 'running' && (from === 'scheduled' || from === 'open')) {
      await Game.updateMany({}, { $set: { isActive: false } });
      game.status = 'running';
      game.isActive = true;
      game.currentRoundNumber = 1;
      game.roundStatus = 'cartela_selection';
      const now = new Date();
      game.countdownEndsAt = new Date(now.getTime() + (game.cartelaSelectionDurationSeconds || 40) * 1000);
      game.calledNumbers = [];
      game.roundWinner = null;
      if (game.roundSelections && game.roundSelections.length) game.roundSelections = [];
      if (game.cartelas && game.cartelas.length) {
        game.cartelas.forEach((c) => {
          c.selected = false;
          c.selectedBy = null;
          c.reservedAt = null;
        });
      }
      await game.save();
      const { getIo, startCountdown } = require('../realtime/gameSocket');
      const io = getIo();
      if (io && startCountdown) startCountdown(io, game);
      return res.status(200).json({ game });
    }

    return res.status(400).json({ message: `Cannot change status from ${from} to ${status}` });
  } catch (err) {
    console.error('Error updating game status', err);
    return res.status(500).json({
      message: err.message || 'Internal server error',
    });
  }
});

module.exports = router;

