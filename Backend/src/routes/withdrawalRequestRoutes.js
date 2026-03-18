const express = require('express');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');
const { generateWithdrawalTransactionId } = require('../utils/generateTransactionId');
const { sendTelegramMessage } = require('../utils/telegramNotify');

const router = express.Router();
const MIN_BIRR = 100;

// POST /api/withdrawal-requests — bot creates withdrawal (after user confirmed)
// Body: { telegramId, amount, bank, accountNumber, accountHolderName }
// Validates: balance >= 100, amount in [100, balance], one pending per user, deducts balance
router.post('/', async (req, res) => {
  try {
    const { telegramId, amount, bank, accountNumber, accountHolderName } = req.body || {};
    if (!telegramId || amount == null || !bank || !accountNumber || !accountHolderName) {
      return res.status(400).json({
        message: 'telegramId, amount, bank, accountNumber, and accountHolderName are required.',
      });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < MIN_BIRR) {
      return res.status(400).json({
        message: `Amount must be at least ${MIN_BIRR} Birr.`,
      });
    }
    if (!['CBE', 'Telebirr'].includes(String(bank).trim())) {
      return res.status(400).json({ message: 'Bank must be CBE or Telebirr.' });
    }
    const accNum = String(accountNumber).trim();
    const accName = String(accountHolderName).trim();
    if (!accNum || !accName) {
      return res.status(400).json({ message: 'Account number and account holder name are required.' });
    }

    const user = await User.findOne({ telegramId: String(telegramId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const balance = Number(user.balance) || 0;
    const reservedAmount = Number(user.reservedAmount) || 0;
    const availableBalance = Math.max(0, balance - reservedAmount);
    if (availableBalance < MIN_BIRR) {
      return res.status(400).json({
        message: `Minimum available balance to withdraw is ${MIN_BIRR} Birr. Available: ${availableBalance} ETB`,
      });
    }
    if (numAmount > availableBalance) {
      return res.status(400).json({
        message: `Amount cannot exceed your available balance. Available: ${availableBalance} ETB`,
      });
    }

    const existing = await WithdrawalRequest.findOne({
      user: user._id,
      status: 'pending',
    }).lean();
    if (existing) {
      return res.status(400).json({
        message: 'You already have a pending withdrawal. Wait for it to be processed.',
      });
    }

    const transactionId = generateWithdrawalTransactionId();
    const previousBalance = balance;
    const newBalance = balance - numAmount;

    const doc = await WithdrawalRequest.create({
      user: user._id,
      amount: numAmount,
      bank: String(bank).trim(),
      accountNumber: accNum,
      accountHolderName: accName,
      transactionId,
      status: 'pending',
      previousBalance,
      newBalance,
    });

    await User.findByIdAndUpdate(user._id, { $set: { balance: newBalance } });

    const populated = await WithdrawalRequest.findById(doc._id)
      .populate('user', 'telegramId username balance')
      .lean();
    return res.status(201).json(populated);
  } catch (err) {
    console.error('Error creating withdrawal request', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/withdrawal-requests/my?telegramId= — user's active (pending) withdrawal
router.get('/my', async (req, res) => {
  try {
    const telegramId = req.query.telegramId;
    if (!telegramId) return res.status(400).json({ message: 'telegramId is required' });
    const user = await User.findOne({ telegramId: String(telegramId) });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const pending = await WithdrawalRequest.findOne({ user: user._id, status: 'pending' })
      .lean();
    return res.json(pending || null);
  } catch (err) {
    console.error('Error fetching my withdrawal', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/withdrawal-requests — admin list; query: status, dateFrom, dateTo
router.get('/', async (req, res) => {
  try {
    const { status, dateFrom, dateTo } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    const list = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'telegramId username phone balance')
      .lean();
    return res.json(list);
  } catch (err) {
    console.error('Error listing withdrawal requests', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/withdrawal-requests/:id — admin approve or reject
// Body: { status: 'approved' | 'rejected', rejectReason?: string }
router.patch('/:id', async (req, res) => {
  try {
    const { status, rejectReason } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }
    const doc = await WithdrawalRequest.findById(req.params.id).populate('user');
    if (!doc) return res.status(404).json({ message: 'Withdrawal request not found' });
    if (doc.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed' });
    }

    const startTime = doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now();
    const processingTimeMs = Math.round(Date.now() - startTime);

    if (status === 'rejected') {
      const refundAmount = doc.amount;
      const currentBalance = Number(doc.user?.balance) ?? doc.newBalance ?? 0;
      const newBalance = currentBalance + refundAmount;
      await User.findByIdAndUpdate(doc.user._id, { $set: { balance: newBalance } });
      doc.status = 'rejected';
      doc.reviewedAt = new Date();
      doc.rejectReason = rejectReason ? String(rejectReason).trim() : null;
      doc.newBalance = newBalance;
      doc.processingTimeMs = processingTimeMs;
      await doc.save();

      const telegramId = doc.user?.telegramId;
      const reason = (doc.rejectReason || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const reasonText = reason ? `\nReason: ${reason}` : '';
      await sendTelegramMessage(
        telegramId,
        `❌ <b>Withdrawal Rejected</b>\n\nTransaction ID: ${doc.transactionId}\nAmount: ${doc.amount} ETB\nBank: ${doc.bank}${reasonText}\n\nYour balance has been refunded: ${newBalance} ETB.`
      );
    } else {
      doc.status = 'approved';
      doc.reviewedAt = new Date();
      doc.processingTimeMs = processingTimeMs;
      doc.newBalance = doc.newBalance ?? (Number(doc.user?.balance) ?? 0);
      await doc.save();

      const telegramId = doc.user?.telegramId;
      const procTime = doc.processingTimeMs >= 60000
        ? `${Math.floor(doc.processingTimeMs / 60000)}m ${Math.floor((doc.processingTimeMs % 60000) / 1000)}s`
        : `${Math.floor(doc.processingTimeMs / 1000)}s`;
      await sendTelegramMessage(
        telegramId,
        `✅ <b>Withdrawal Approved</b>\n\nTransaction ID: ${doc.transactionId}\nAmount: ${doc.amount} ETB\nBank: ${doc.bank}\nAccount: ${doc.accountNumber}\n\nPrevious balance: ${doc.previousBalance} ETB\nNew balance: ${doc.newBalance} ETB\nProcessing time: ${procTime}`
      );
    }

    const updated = await WithdrawalRequest.findById(doc._id)
      .populate('user', 'telegramId username balance')
      .lean();
    return res.json(updated);
  } catch (err) {
    console.error('Error updating withdrawal request', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
