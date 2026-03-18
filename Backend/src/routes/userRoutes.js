const express = require('express');
const User = require('../models/User');
const DepositRequest = require('../models/DepositRequest');
const WithdrawalRequest = require('../models/WithdrawalRequest');

const router = express.Router();

// GET /api/users/balance/:telegramId
router.get('/balance/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await User.findOne({ telegramId: String(telegramId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const balance = Number(user.balance) || 0;
    const reservedAmount = Number(user.reservedAmount) || 0;
    const availableBalance = Math.max(0, balance - reservedAmount);
    return res.status(200).json({ balance, reservedAmount, availableBalance });
  } catch (err) {
    console.error('Error in GET /api/users/balance/:telegramId', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/users — list users for admin (with totalDeposits, totalWithdrawals). Query: search
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim().toLowerCase();
    const match = {};
    if (search) {
      match.$or = [
        { telegramId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const users = await User.aggregate([
      { $match: Object.keys(match).length ? match : {} },
      {
        $lookup: {
          from: 'depositrequests',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$user', '$$userId'] }, status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ],
          as: 'depAgg',
        },
      },
      {
        $lookup: {
          from: 'withdrawalrequests',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$user', '$$userId'] }, status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ],
          as: 'withdrawAgg',
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          id: { $toString: '$_id' },
          telegramId: 1,
          username: 1,
          phone: 1,
          balance: 1,
          status: { $ifNull: ['$status', 'ACTIVE'] },
          registeredAt: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalDeposits: { $ifNull: [{ $arrayElemAt: ['$depAgg.total', 0] }, 0] },
          totalWithdrawals: { $ifNull: [{ $arrayElemAt: ['$withdrawAgg.total', 0] }, 0] },
        },
      },
    ]);
    return res.json(users);
  } catch (err) {
    console.error('Error in GET /api/users', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/users/:id/history — recent deposits and withdrawals for admin History modal
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const [deposits, withdrawals] = await Promise.all([
      DepositRequest.find({ user: id, status: 'approved' })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('paymentMethod', 'name')
        .lean(),
      WithdrawalRequest.find({ user: id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    const history = [
      ...deposits.map((d) => ({
        type: 'deposit',
        date: d.createdAt,
        amount: d.amount,
        label: `Deposit ${d.amount} ETB${d.paymentMethod?.name ? ` via ${d.paymentMethod.name}` : ''}`,
      })),
      ...withdrawals.map((w) => ({
        type: 'withdrawal',
        date: w.createdAt,
        amount: w.amount,
        status: w.status,
        label: `Withdrawal ${w.amount} ETB (${w.status})`,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 30);
    return res.json(history);
  } catch (err) {
    console.error('Error in GET /api/users/:id/history', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/users/:id — one user for admin Profile modal
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    const [depSum, withdrawSum] = await Promise.all([
      DepositRequest.aggregate([
        { $match: { user: user._id, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      WithdrawalRequest.aggregate([
        { $match: { user: user._id, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    return res.json({
      ...user,
      id: user._id.toString(),
      totalDeposits: depSum[0]?.total ?? 0,
      totalWithdrawals: withdrawSum[0]?.total ?? 0,
      status: user.status || 'ACTIVE',
      registeredAt: user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : null,
    });
  } catch (err) {
    console.error('Error in GET /api/users/:id', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/users/:id — adjust balance and/or block/unblock
// Body: { adjustment?: number, reason?: string } or { status?: 'ACTIVE'|'BLOCKED' }
router.patch('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { adjustment, reason, status: newStatus } = req.body || {};
    if (typeof adjustment === 'number' && adjustment !== 0) {
      const newBalance = (user.balance || 0) + adjustment;
      if (newBalance < 0) {
        return res.status(400).json({ message: 'Resulting balance cannot be negative.' });
      }
      user.balance = Math.round(newBalance * 100) / 100;
      // optional: log adjustment (reason) in a BalanceLog collection if you add one later
    }
    if (newStatus === 'ACTIVE' || newStatus === 'BLOCKED') {
      user.status = newStatus;
    }
    await user.save();
    return res.json(user);
  } catch (err) {
    console.error('Error in PATCH /api/users/:id', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
