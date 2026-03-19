const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Bet = require('../models/Bet');
const DepositRequest = require('../models/DepositRequest');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'bingo-admin-secret-change-in-production';
const SALT_ROUNDS = 10;

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded?.role !== 'admin') return res.status(401).json({ message: 'Invalid token' });

    req.admin = decoded;
    return next();
  } catch (err) {
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}

function getPeriodRange(period) {
  const now = new Date();
  if (period === 'weekly') {
    // ISO week starting Monday (server local time).
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    const daysSinceMonday = (day + 6) % 7;
    const from = new Date(now);
    from.setDate(now.getDate() - daysSinceMonday);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (period === 'monthly') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }

  // daily (default): from today's midnight to now
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  return { from, to: now };
}

function getPeriodLabel(period, fromDate, toDate) {
  const monthYear = fromDate.toLocaleString(undefined, { month: 'short', year: 'numeric' });
  if (period === 'monthly') return monthYear;
  if (period === 'weekly') {
    const fromLabel = fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const toLabel = toDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fromLabel} - ${toLabel}`;
  }
  return fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** GET /api/admin/health — verify admin routes are loaded */
router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Admin API is up' });
});

/**
 * POST /api/admin/ensure-first-admin
 * Creates the first admin if none exist. Body: { username?, password? } (defaults: admin, admin123).
 * Use this from Postman when admin was not created on startup.
 */
router.post('/ensure-first-admin', async (req, res) => {
  try {
    const existing = await Admin.countDocuments();
    if (existing > 0) {
      return res.status(400).json({ message: 'An admin already exists. Use /api/admin/login to sign in.' });
    }
    const username = (req.body?.username && String(req.body.username).trim()) || 'admin';
    const password = (req.body?.password && String(req.body.password)) || 'admin123';
    const name = username.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await Admin.create({ username: name, passwordHash });
    return res.status(201).json({
      message: 'First admin created. Use POST /api/admin/login with this username and password.',
      admin: { username: name },
    });
  } catch (err) {
    console.error('ensure-first-admin error', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/admin/seed-from-settings
 * If no admins exist and Settings has adminUsername + adminPasswordHash, create the first admin.
 */
router.post('/seed-from-settings', async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const existing = await Admin.countDocuments();
    if (existing > 0) {
      return res.status(400).json({ message: 'An admin already exists. Seed only runs when there are no admins.' });
    }
    const settings = await Settings.findOne().select('adminUsername adminPasswordHash').lean();
    if (!settings?.adminUsername || !settings?.adminPasswordHash) {
      return res.status(400).json({ message: 'Save admin username and password in Settings first.' });
    }
    await Admin.create({
      username: settings.adminUsername,
      passwordHash: settings.adminPasswordHash,
    });
    return res.status(201).json({ message: 'Admin created from Settings.', admin: { username: settings.adminUsername } });
  } catch (err) {
    console.error('Admin seed-from-settings error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/admin/login
 * Body: { username, password }
 * Returns: { token, admin: { username } }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || typeof username !== 'string' || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const name = username.trim().toLowerCase();
    if (!name) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const admin = await Admin.findOne({ username: name }).lean();
    if (!admin) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { sub: admin._id.toString(), role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      admin: { username: admin.username },
    });
  } catch (err) {
    console.error('Admin login error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/admin/me — validate token, return admin info (optional, for frontend)
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    const admin = await Admin.findById(decoded.sub).select('username').lean();
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }
    return res.status(200).json({ admin: { username: admin.username } });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    console.error('Admin me error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/admin/revenue?period=daily|weekly|monthly
 * Provides admin revenue metrics + deposits/withdrawals tables + game fees + agent commissions.
 */
router.get('/revenue', requireAdmin, async (req, res) => {
  try {
    const periodRaw = req.query.period;
    const period = periodRaw ? String(periodRaw).toLowerCase() : 'daily';
    const normalizedPeriod = ['daily', 'weekly', 'monthly'].includes(period) ? period : 'daily';

    const { from, to } = getPeriodRange(normalizedPeriod);
    const periodLabel = getPeriodLabel(normalizedPeriod, from, to);

    const betMatch = {
      updatedAt: { $gte: from, $lte: to },
      status: { $in: ['won', 'lost'] },
    };

    const totalsAgg = await Bet.aggregate([
      { $match: betMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$betAmount' },
          totalPayouts: { $sum: '$prize' },
          gameIds: { $addToSet: '$gameId' },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalPayouts: 1,
          gameCount: { $size: '$gameIds' },
        },
      },
    ]);

    const totalsRow = totalsAgg[0] || { totalRevenue: 0, totalPayouts: 0, gameCount: 0 };
    const totalRevenue = Number(totalsRow.totalRevenue) || 0;
    const totalPayouts = Number(totalsRow.totalPayouts) || 0;
    const platformProfit = totalRevenue - totalPayouts;
    const avgProfitPerGame = totalsRow.gameCount > 0 ? Math.round(platformProfit / totalsRow.gameCount) : 0;

    // Deposits / withdrawals are admin-reviewed amounts.
    const [deposits, withdrawals] = await Promise.all([
      DepositRequest.find({
        status: 'approved',
        reviewedAt: { $gte: from, $lte: to },
      })
        .sort({ reviewedAt: -1 })
        .limit(10)
        .populate('user', 'telegramId username phone role')
        .lean(),
      WithdrawalRequest.find({
        status: 'approved',
        reviewedAt: { $gte: from, $lte: to },
      })
        .sort({ reviewedAt: -1 })
        .limit(10)
        .populate('user', 'telegramId username phone role')
        .lean(),
    ]);

    const depositsOut = deposits.map((d) => ({
      _id: d._id,
      amount: d.amount,
      user: d.user
        ? { username: d.user.username, telegramId: d.user.telegramId, phone: d.user.phone }
        : null,
      time: d.reviewedAt || d.createdAt,
    }));

    const withdrawalsOut = withdrawals.map((w) => ({
      _id: w._id,
      amount: w.amount,
      user: w.user
        ? { username: w.user.username, telegramId: w.user.telegramId, phone: w.user.phone }
        : null,
      time: w.reviewedAt || w.createdAt,
    }));

    // Game fees: platform fee is approximated as (total stake - total payout) per game for bets updated in range.
    const [gameFees, chartPoints, agentStakeRows] = await Promise.all([
      Bet.aggregate([
        { $match: betMatch },
        {
          $group: {
            _id: '$gameId',
            stake: { $sum: '$betAmount' },
            payout: { $sum: '$prize' },
          },
        },
        {
          $project: {
            _id: 0,
            gameId: '$_id',
            stake: 1,
            platformFee: { $subtract: ['$stake', '$payout'] },
          },
        },
        { $sort: { platformFee: -1 } },
        { $limit: 10 },
      ]),

      (async () => {
        const format =
          normalizedPeriod === 'daily' ? '%Y-%m-%d' : normalizedPeriod === 'weekly' ? '%G-W%V' : '%Y-%m';
        const pts = await Bet.aggregate([
          { $match: betMatch },
          {
            $group: {
              _id: {
                $dateToString: {
                  format,
                  date: '$updatedAt',
                  timezone: 'UTC',
                },
              },
              revenue: { $sum: '$betAmount' },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: normalizedPeriod === 'daily' ? 14 : 8 },
        ]);
        return pts.map((p) => ({ label: p._id, revenue: Number(p.revenue) || 0 }));
      })(),

      (async () => {
        // Agent commissions are allocated from platform profit based on stake contributed by users referred by each agent.
        const rows = await Bet.aggregate([
          { $match: betMatch },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: '$user' },
          { $match: { 'user.referredBy': { $ne: null } } },
          {
            $group: {
              _id: '$user.referredBy',
              agentStake: { $sum: '$betAmount' },
            },
          },
          { $sort: { agentStake: -1 } },
          { $limit: 20 },
        ]);
        return rows.map((r) => ({ agentId: r._id, agentStake: Number(r.agentStake) || 0 }));
      })(),
    ]);

    const agentIds = agentStakeRows.map((r) => r.agentId).filter(Boolean);
    const agents = agentIds.length
      ? await User.find({ _id: { $in: agentIds }, role: 'agent' }).select('_id username telegramId').lean()
      : [];
    const agentMap = new Map(agents.map((a) => [String(a._id), a]));

    const agentCommissionsOut = agentStakeRows
      .map((r) => {
        const totalStakeShare = totalRevenue > 0 ? r.agentStake / totalRevenue : 0;
        const commission = Math.round(platformProfit * totalStakeShare);
        const agent = agentMap.get(String(r.agentId));
        return {
          agent: agent?.username ? `@${agent.username}` : `@agent_${String(r.agentId).slice(-6)}`,
          commission,
          period: periodLabel,
        };
      })
      .filter((x) => x.commission !== 0)
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 10);

    return res.json({
      period: normalizedPeriod,
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        totalRevenue,
        totalPayouts,
        platformProfit,
        avgProfitPerGame,
      },
      chart: { points: chartPoints },
      deposits: depositsOut,
      withdrawals: withdrawalsOut,
      gameFees: gameFees.map((g) => ({
        gameId: g.gameId,
        stake: Number(g.stake) || 0,
        platformFee: Number(g.platformFee) || 0,
      })),
      agentCommissions: agentCommissionsOut,
    });
  } catch (err) {
    console.error('Admin revenue error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
