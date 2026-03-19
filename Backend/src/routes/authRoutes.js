const express = require('express');
const User = require('../models/User');
const Settings = require('../models/Settings');
const getSettings = Settings.getSettings;

const router = express.Router();

// GET /api/auth/me?telegramId=xxx - check if user is already registered
router.get('/me', async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId) {
      return res.status(400).json({ message: 'telegramId is required' });
    }
    const user = await User.findOne({ telegramId: String(telegramId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('Error in /api/auth/me', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/register
// Body: { telegramId, username?, phone?, referralAgentId? }
router.post('/register', async (req, res) => {
  try {
    const { telegramId, username, phone, referralAgentId } = req.body;

    if (!telegramId) {
      return res.status(400).json({ message: 'telegramId is required' });
    }

    // Ensure telegramId is unique - if exists, just return existing user
    let user = await User.findOne({ telegramId });
    if (user) {
      return res.status(200).json({
        message: 'User already registered',
        user,
      });
    }

    let referredBy = null;

    // If referralAgentId is provided, verify it's an agent and use its id
    if (referralAgentId) {
      const agent = await User.findOne({ _id: referralAgentId, role: 'agent' });
      if (agent) {
        referredBy = agent._id;
      }
    }

    user = await User.create({
      telegramId: String(telegramId),
      username,
      phone,
      // default balance = 0
      balance: 0,
      // default role = 'user'
      role: 'user',
      // optional referredBy if joined with agent referral link
      referredBy,
    });

    // Optional welcome bonus for new registrations.
    // Credits balance immediately; no additional ledger records are created.
    const settings = await getSettings();
    const bonusEnabled = settings?.welcomeBonusEnabled === true;
    const bonusAmount = Number(settings?.welcomeBonusAmount) || 0;
    if (bonusEnabled && bonusAmount > 0) {
      await User.findByIdAndUpdate(user._id, { $inc: { balance: bonusAmount } });
      user.balance = bonusAmount; // reflects credited amount on top of default 0
    }

    return res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (err) {
    // Handle unique constraint race condition
    if (err.code === 11000 && err.keyPattern && err.keyPattern.telegramId) {
      const existing = await User.findOne({ telegramId: req.body.telegramId });
      if (existing) {
        return res.status(200).json({
          message: 'User already registered',
          user: existing,
        });
      }
    }

    console.error('Error in /api/auth/register', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

