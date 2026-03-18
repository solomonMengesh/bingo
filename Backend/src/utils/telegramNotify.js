const axios = require('axios');

function getTelegramApi() {
  const token = process.env.BOT_TOKEN;
  return token ? `https://api.telegram.org/bot${token}` : null;
}

/**
 * Send a text message to a Telegram user by telegramId (chat_id).
 * telegramId can be the user's id (number or string).
 * Returns { ok: true } or { ok: false, skipped?: true }.
 */
async function sendTelegramMessage(telegramId, text) {
  const api = getTelegramApi();
  if (!api || !telegramId) {
    if (!api) console.warn('Telegram notify skipped: BOT_TOKEN not set in backend .env');
    return { ok: false, skipped: !api };
  }
  try {
    const res = await axios.post(`${api}/sendMessage`, {
      chat_id: String(telegramId),
      text: String(text),
      parse_mode: 'HTML',
    });
    return res.data?.ok ? { ok: true } : { ok: false };
  } catch (err) {
    console.error('Telegram sendMessage error:', err?.response?.data || err.message);
    return { ok: false };
  }
}

module.exports = { sendTelegramMessage };
