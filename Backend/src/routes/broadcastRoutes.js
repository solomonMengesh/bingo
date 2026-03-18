const express = require('express');
const axios = require('axios');
const User = require('../models/User');

const router = express.Router();
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

/** Throttle: run promises in batches with delay between batches */
function throttle(allItems, batchSize, fn) {
  const results = [];
  let index = 0;
  return new Promise((resolve, reject) => {
    function runBatch() {
      const batch = allItems.slice(index, index + batchSize);
      index += batchSize;
      if (batch.length === 0) {
        return resolve(results);
      }
      Promise.all(batch.map((item, i) => fn(item, index - batchSize + i)))
        .then((batchResults) => {
          results.push(...batchResults);
          if (index >= allItems.length) return resolve(results);
          return new Promise((r) => setTimeout(r, 100)).then(runBatch);
        })
        .catch(reject);
    }
    runBatch();
  });
}

/**
 * POST /api/broadcast
 * Body: { title?, message }
 * Sends the message to all users with telegramId via the Telegram Bot API.
 */
router.post('/', async (req, res) => {
  try {
    const { title, message } = req.body || {};
    const text = [title, message].filter(Boolean).join('\n\n').trim();
    if (!text) {
      return res.status(400).json({ message: 'Title or message is required' });
    }
    if (!TELEGRAM_API) {
      return res.status(503).json({ message: 'Bot token not configured. Set BOT_TOKEN in .env.' });
    }

    const users = await User.find({ telegramId: { $exists: true, $ne: '' } })
      .select('telegramId')
      .lean();
    const chatIds = users.map((u) => u.telegramId).filter(Boolean);

    if (chatIds.length === 0) {
      return res.status(200).json({ total: 0, sent: 0, failed: 0, message: 'No users to send to.' });
    }

    let sent = 0;
    let failed = 0;

    await throttle(chatIds, 25, async (chatId) => {
      try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }, { timeout: 10000 });
        sent++;
        return { ok: true };
      } catch (err) {
        failed++;
        return { ok: false };
      }
    });

    return res.status(200).json({
      total: chatIds.length,
      sent,
      failed,
      message: `Broadcast sent to ${sent} user(s).${failed > 0 ? ` ${failed} failed.` : ''}`,
    });
  } catch (err) {
    console.error('Broadcast error', err);
    return res.status(500).json({ message: err.message || 'Broadcast failed' });
  }
});

module.exports = router;
