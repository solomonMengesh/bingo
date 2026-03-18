const express = require('express');
const Bet = require('../models/Bet');
const User = require('../models/User');

const router = express.Router();

/**
 * GET /api/bets/history/by-telegram/:telegramId
 * Same response as /history/:userId. For bot use. Must be defined before /history/:userId.
 */
router.get('/history/by-telegram/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: String(req.params.telegramId) }).select('_id').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userId = user._id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const statusFilter = req.query.status ? String(req.query.status).trim() : null;
    const validStatuses = ['running', 'won', 'lost', 'cancelled'];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return res.status(400).json({ message: 'Invalid status filter' });
    }
    const query = { userId };
    if (statusFilter) query.status = statusFilter;
    const [bets, total] = await Promise.all([
      Bet.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('gameId', 'stakeEtb _id').lean(),
      Bet.countDocuments(query),
    ]);
    const totalPages = Math.ceil(total / limit) || 1;
    const resolved = await Bet.find({ userId, status: { $in: ['won', 'lost'] } }, { betAmount: 1, prize: 1 }).lean();
    const profitLoss = resolved.reduce((acc, b) => acc + (b.prize || 0) - (b.betAmount || 0), 0);
    return res.status(200).json({ bets, total, page, limit, totalPages, profitLoss });
  } catch (err) {
    console.error('Error in by-telegram bet history', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/bets/history/:userId
 * Query: page (default 1), limit (default 20), status (optional: running|won|lost|cancelled)
 * Response: { bets, total, page, limit, totalPages, profitLoss }
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const statusFilter = req.query.status ? String(req.query.status).trim() : null;
    const validStatuses = ['running', 'won', 'lost', 'cancelled'];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return res.status(400).json({ message: 'Invalid status filter' });
    }

    const query = { userId };
    if (statusFilter) query.status = statusFilter;

    const [bets, total] = await Promise.all([
      Bet.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('gameId', 'stakeEtb _id')
        .lean(),
      Bet.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const resolved = await Bet.find(
      { userId, status: { $in: ['won', 'lost'] } },
      { betAmount: 1, prize: 1 }
    ).lean();
    const profitLoss = resolved.reduce((acc, b) => acc + (b.prize || 0) - (b.betAmount || 0), 0);

    return res.status(200).json({
      bets,
      total,
      page,
      limit,
      totalPages,
      profitLoss,
    });
  } catch (err) {
    console.error('Error fetching bet history', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
