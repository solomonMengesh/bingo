const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:5000';
const GAME_WEBAPP_URL = process.env.GAME_WEBAPP_URL; // HTTPS required for Mini App (e.g. ngrok in dev)

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const RESTART_DELAY_MS = 5000;
let restartTimeout = null;

function startPolling() {
  bot.startPolling().catch((err) => {
    console.error('Bot startPolling failed:', err.message || err);
    scheduleRestart();
  });
}

function scheduleRestart() {
  if (restartTimeout) return;
  console.log(`Restarting polling in ${RESTART_DELAY_MS / 1000}s after connection error...`);
  restartTimeout = setTimeout(() => {
    restartTimeout = null;
    if (bot.isPolling()) {
      bot.stopPolling().then(() => startPolling()).catch(() => startPolling());
    } else {
      startPolling();
    }
  }, RESTART_DELAY_MS);
}

bot.on('polling_error', (err) => {
  console.error('Bot polling_error:', err.message || err);
  if (err.code === 'EFATAL' || err.message?.includes('ECONNRESET') || err.message?.includes('ETIMEDOUT')) {
    scheduleRestart();
  }
});

// Register bot commands and set menu button (shows "Menu" next to input in Telegram)
async function setupMenuButton() {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Start or open games' },
      { command: 'menu', description: 'Open main keyboard' },
      { command: 'play', description: '🎮 Play Bingo (Mini App)' },
      { command: 'deposit', description: '💰 Deposit' },
      { command: 'withdraw', description: '💸 Withdraw' },
      { command: 'balance', description: '📊 Show balance' },
      { command: 'history', description: '📜 Bet history (last 10)' },
    ]);
    await bot.setChatMenuButton({ menu_button: { type: 'commands' } });
    console.log('Bot menu button and commands set.');
  } catch (err) {
    console.warn('Could not set bot menu/commands:', err.message || err);
  }
}

startPolling();
setupMenuButton();
console.log('Telegram Bingo Bot is running...');

// In-memory store for pending registrations and referral agent IDs
// Keyed by Telegram user ID (string)
const pendingReferrals = {};

// Pending deposit: after user selects a payment method, next message = SMS or transaction ID
// Key: chatId (number), value: { paymentMethodId, paymentMethod }
const pendingDeposit = {};

// Pending withdrawal: multi-step flow. Key: chatId, value: { step, balance, amount, bank, accountNumber, accountHolderName }
const pendingWithdraw = {};
const WITHDRAW_MIN_BIRR = 100;

// Helper to show the phone number request keyboard
async function askForPhoneNumber(chatId, { viaReferral } = {}) {
  const baseText =
    '📋 Registration Process\n\nPlease share your phone number to register automatically.\n\nUse the button below to share your phone number securely.';

  const referralText =
    '🎯 You\'re joining via an agent referral!\nPlease share your phone number using the button below.';

  const text = viaReferral ? `${referralText}` : `${baseText}`;

  await bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        [
          {
            text: '📱 Share Phone Number',
            request_contact: true,
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  });
}

// Main menu keyboard (reusable)
const mainMenuKeyboard = {
  reply_markup: {
    keyboard: [
      ['🎮 Play Bingo', '🔄 Refresh'],
      ['💰 Deposit', '💸 Withdraw'],
      ['📊 Balance', '📜 Bet History'],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

async function getWelcomeBonusSettings() {
  const res = await axios.get(`${BACKEND_BASE_URL}/api/settings`, { validateStatus: () => true });
  const data = res?.data || {};
  return {
    enabled: data?.welcomeBonusEnabled === true,
    amount: Number(data?.welcomeBonusAmount) || 0,
  };
}

async function ensureRegistered(chatId, telegramId) {
  if (!telegramId) {
    await bot.sendMessage(chatId, 'Could not identify your account. Use /start to register first.');
    return null;
  }

  const meRes = await axios.get(`${BACKEND_BASE_URL}/api/auth/me`, {
    params: { telegramId },
    validateStatus: () => true,
  });

  const user = meRes?.data?.user;
  if (!user) {
    await bot.sendMessage(chatId, 'You are not registered. Use /start to register first.');
    return null;
  }

  return user;
}

const MAINTENANCE_MESSAGE = 'Service is temporarily under maintenance. Please try again later.';
let maintenanceCache = { value: null, untilMs: 0 };

async function isMaintenanceOn() {
  if (maintenanceCache.untilMs > Date.now() && typeof maintenanceCache.value === 'boolean') {
    return maintenanceCache.value;
  }
  try {
    const res = await axios.get(`${BACKEND_BASE_URL}/api/settings`, { validateStatus: () => true });
    const data = res?.data || {};
    const on = data?.maintenanceMode === true;
    maintenanceCache = { value: on, untilMs: Date.now() + 15000 };
    return on;
  } catch {
    // If settings fetch fails, do not block the bot.
    maintenanceCache = { value: false, untilMs: Date.now() + 5000 };
    return false;
  }
}

async function ensureNotMaintenance(chatId) {
  const on = await isMaintenanceOn();
  if (!on) return true;
  await bot.sendMessage(chatId, MAINTENANCE_MESSAGE);
  return false;
}

/** Build and return the "Available Bingo Games" message text (running + scheduled). */
async function buildGamesListMessage() {
  let text = '🎮 <b>Available Bingo Games</b>\n\n';
  try {
    const [runningRes, scheduledRes] = await Promise.all([
      axios.get(`${BACKEND_BASE_URL}/api/games`, { params: { status: 'running' }, validateStatus: () => true }),
      axios.get(`${BACKEND_BASE_URL}/api/games`, { params: { status: 'scheduled,open' }, validateStatus: () => true }),
    ]);
    const runningGames = Array.isArray(runningRes?.data?.games) ? runningRes.data.games : (Array.isArray(runningRes?.data) ? runningRes.data : []);
    const scheduledGames = Array.isArray(scheduledRes?.data?.games) ? scheduledRes.data.games : (Array.isArray(scheduledRes?.data) ? scheduledRes.data : []);

    function formatCountdown(msRemaining) {
      if (msRemaining <= 0 || msRemaining < 60000) return 'Starts soon';
      const totalMins = Math.floor(msRemaining / 60000);
      const days = Math.floor(totalMins / 1440);
      const hours = Math.floor((totalMins % 1440) / 60);
      const mins = totalMins % 60;
      const parts = [];
      if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0 || parts.length === 0) parts.push(`${mins} min`);
      return parts.join(' ');
    }

    text += '🔥 <b>Running Games</b>\n';
    if (runningGames.length > 0) {
      runningGames.forEach((g) => {
        text += `• Game #${g._id ? String(g._id).slice(-6) : '?'} – Join Now\n`;
      });
    } else {
      text += '• No games running at the moment.\n';
    }
    text += '\n⏳ <b>Scheduled Games</b> <i>(Discount Time)</i>\n';
    if (scheduledGames.length > 0) {
      scheduledGames.forEach((g) => {
        const gameNum = g._id ? String(g._id).slice(-6) : '?';
        text += `• Game #${gameNum} – Discount period active\n`;
        const startAt = g.scheduledStartAt ? new Date(g.scheduledStartAt).getTime() : null;
        let countdown = 'Starts soon';
        if (startAt && startAt > Date.now()) countdown = formatCountdown(startAt - Date.now());
        else if (!startAt && g.createdAt) {
          const assumedMs = 15 * 60000;
          countdown = formatCountdown(Math.max(0, assumedMs - (Date.now() - new Date(g.createdAt).getTime())));
        }
        text += countdown === 'Starts soon' ? '  Starts soon\n' : `  Discount time — ${countdown}\n`;
      });
    } else {
      text += '• No scheduled games.\n';
    }
    text += '\nTap <b>🎮 Play Bingo</b> below to join.';
  } catch (e) {
    console.error('Games fetch error:', e?.response?.data || e.message);
    text += 'Tap <b>🎮 Play Bingo</b> below to open the lobby.';
  }
  return text;
}

// /menu — show main menu keyboard
bot.onText(/^\/menu\s*$/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await ensureNotMaintenance(chatId))) return;
  const telegramId = String(msg.from?.id || '');
  if (telegramId) {
    const u = await ensureRegistered(chatId, telegramId);
    if (!u) return;
  }
  await bot.sendMessage(chatId, 'Main menu:', mainMenuKeyboard);
});

// /play — same as \"🎮 Play Bingo\" button
bot.onText(/^\/play\s*$/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await ensureNotMaintenance(chatId))) return;
  const telegramId = String(msg.from?.id || '');
  const u = await ensureRegistered(chatId, telegramId);
  if (!u) return;
  if (!GAME_WEBAPP_URL || !GAME_WEBAPP_URL.startsWith('https://')) {
    await bot.sendMessage(
      chatId,
      'Mini App is not configured. Set GAME_WEBAPP_URL (HTTPS) in .env, e.g. your ngrok URL.'
    );
    return;
  }
  const base = GAME_WEBAPP_URL.trim().replace(/\/+$/, '');
  const webAppUrl = `${base}?telegramId=${encodeURIComponent(telegramId)}`;
  await bot.sendMessage(chatId, 'Open the game to play Bingo:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Play Now', web_app: { url: webAppUrl } }],
      ],
    },
  });
});

// /history — show last 10 bets (same as Bet History button)
bot.onText(/^\/history\s*$/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await ensureNotMaintenance(chatId))) return;
  const telegramId = String(msg.from?.id || '');
  if (!telegramId) {
    await bot.sendMessage(chatId, 'Could not identify your account.');
    return;
  }
  try {
    const res = await axios.get(`${BACKEND_BASE_URL}/api/bets/history/by-telegram/${telegramId}`, {
      params: { limit: 10 },
      validateStatus: (s) => s === 200 || s === 404,
    });
    if (res.status === 404) {
      await bot.sendMessage(chatId, 'You are not registered. Use /start to register first.');
      return;
    }
    const { bets = [], total, profitLoss } = res.data || {};
    const formatDate = (d) => {
      if (!d) return '—';
      const dt = new Date(d);
      return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    let reply = '📜 <b>Bet History</b> (last 10)\n\n';
    if (bets.length === 0) {
      reply += 'No bets yet. Join a game and select a cartela to place a bet.';
    } else {
      bets.forEach((b, i) => {
        const gameId = b.gameId?._id ? String(b.gameId._id).slice(-6) : '?';
        reply += `${i + 1}. Game #${gameId} | ${b.betAmount ?? 0} ETB | ${b.status ?? '—'} | Prize: ${b.prize ?? 0} ETB | ${formatDate(b.createdAt)}\n`;
      });
      reply += `\nTotal bets: ${total}`;
      if (typeof profitLoss === 'number') reply += `\n📊 Profit/Loss: ${profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)} ETB`;
    }
    await bot.sendMessage(chatId, reply, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Bet history /history error:', err?.response?.data || err.message);
    await bot.sendMessage(chatId, 'Unable to load bet history. Please try again later.');
  }
});

// Handle /start and /start AGENT_ID
bot.onText(/^\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!(await ensureNotMaintenance(chatId))) return;
  const telegramId = String(msg.from.id);
  const agentIdFromCommand = match && match[1] ? match[1].trim() : '';

  // Store referralAgentId (if any) for when the user shares contact
  pendingReferrals[telegramId] = agentIdFromCommand || null;

  try {
    // If user is already registered, show menu and list of RUNNING games
    const meRes = await axios.get(`${BACKEND_BASE_URL}/api/auth/me`, {
      params: { telegramId },
      validateStatus: () => true,
    });
    if (meRes.status === 200 && meRes.data && meRes.data.user) {
      const welcomeText = await buildGamesListMessage();
      await bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        ...mainMenuKeyboard,
      });
      return;
    }

    // New user: ask for phone first (never send "Welcome to Bingo Game 🎉" here)
    const viaReferral = Boolean(agentIdFromCommand);
    await askForPhoneNumber(chatId, { viaReferral });
  } catch (error) {
    console.error('Error in /start:', error?.response?.data || error.message);
    await bot.sendMessage(
      chatId,
      'Unable to start the registration process right now. Please try again later.'
    );
  }
});

// Handle user sharing their contact
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;

  if (!msg.contact) {
    return;
  }
  if (!(await ensureNotMaintenance(chatId))) return;

  const contact = msg.contact;
  const phoneNumber = contact.phone_number;
  const telegramId = String(contact.user_id || msg.from.id);
  const username = msg.from.username || '';
  const referralAgentId = pendingReferrals[telegramId] || null;

  const payload = {
    telegramId,
    username,
    phone: phoneNumber,
  };

  if (referralAgentId) {
    payload.referralAgentId = referralAgentId;
  }

  try {
    await axios.post(`${BACKEND_BASE_URL}/api/auth/register`, payload);

    // Registration succeeded, clear pending referral
    delete pendingReferrals[telegramId];

    let welcomeText = '✅ Registration successful!\nWelcome to Bingo Game 🎉';
    try {
      const bonus = await getWelcomeBonusSettings();
      if (bonus.enabled && bonus.amount > 0) {
        welcomeText += `\n🎁 Welcome bonus: ${bonus.amount} ETB`;
      }
    } catch (e) {
      // Ignore settings fetch errors; still show registration success.
    }

    await bot.sendMessage(chatId, welcomeText, mainMenuKeyboard);
  } catch (error) {
    console.error('Error registering user from contact:', error?.response?.data || error.message);

    let errorMessage = 'Something went wrong while registering you. Please try again later.';

    if (error.response && error.response.data && error.response.data.message) {
      errorMessage = error.response.data.message;
    }

    await bot.sendMessage(chatId, errorMessage);
  }
});

// /deposit command — same as Deposit button
bot.onText(/^\/deposit\s*$/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await ensureNotMaintenance(chatId))) return;
  const telegramId = String(msg.from?.id || '');
  const u = await ensureRegistered(chatId, telegramId);
  if (!u) return;
  try {
    const res = await axios.get(`${BACKEND_BASE_URL}/api/payment-methods`, {
      params: { enabled: 'true' },
      validateStatus: (s) => s === 200,
    });
    const methods = Array.isArray(res.data) ? res.data : [];
    if (methods.length === 0) {
      await bot.sendMessage(chatId, 'No deposit methods are available at the moment. Please try again later.');
      return;
    }
    const rows = methods.map((m) => [
      { text: `${m.type === 'mobile_money' ? '📱' : '🏦'} ${m.name}`, callback_data: `deposit_pm_${m._id}` },
    ]);
    await bot.sendMessage(chatId, '💳 Choose payment method:', {
      reply_markup: { inline_keyboard: rows },
    });
  } catch (err) {
    console.error('Deposit methods fetch error:', err?.response?.data || err.message);
    await bot.sendMessage(chatId, 'Unable to load deposit options. Please try again later.');
  }
});

// /withdraw — same as \"💸 Withdraw\" button
bot.onText(/^\/withdraw\s*$/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await ensureNotMaintenance(chatId))) return;
  const telegramId = String(msg.from?.id || '');
  try {
    const balanceRes = await axios.get(`${BACKEND_BASE_URL}/api/users/balance/${telegramId}`, {
      validateStatus: (s) => s === 200 || s === 404,
    });
    if (balanceRes.status === 404) {
      await bot.sendMessage(chatId, 'You are not registered. Use /start to register first.');
      return;
    }
    const balance = balanceRes.data?.balance ?? 0;
    const reserved = balanceRes.data?.reservedAmount ?? 0;
    const available = balanceRes.data?.availableBalance ?? Math.max(0, balance - reserved);
    if (available < WITHDRAW_MIN_BIRR) {
      await bot.sendMessage(
        chatId,
        `Minimum available balance to withdraw is ${WITHDRAW_MIN_BIRR} Birr.\n\nYour available balance: ${available} ETB`
      );
      return;
    }
    const myRes = await axios.get(`${BACKEND_BASE_URL}/api/withdrawal-requests/my`, {
      params: { telegramId },
      validateStatus: (s) => s === 200,
    });
    if (myRes.data) {
      await bot.sendMessage(
        chatId,
        `You already have a pending withdrawal (${myRes.data.amount} ETB). Please wait for it to be processed.`
      );
      return;
    }
    pendingWithdraw[chatId] = { step: 'amount', balance: available, amount: null, bank: null, accountNumber: null, accountHolderName: null };
    const reservedLine = reserved > 0 ? `\nReserved: ${reserved} ETB` : '';
    await bot.sendMessage(
      chatId,
      `💸 <b>Withdraw</b>\n\nAvailable: ${available} ETB${reservedLine}\nCurrent balance: ${balance} ETB\n\nEnter the amount you want to withdraw (minimum ${WITHDRAW_MIN_BIRR} ETB, maximum ${available} ETB):\n\nType /cancel to cancel.`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Withdraw start error (/withdraw):', err?.response?.data || err.message);
    await bot.sendMessage(chatId, 'Unable to start withdrawal. Please try again later.');
  }
});

// /balance — same as \"📊 Balance\" button
bot.onText(/^\/balance\s*$/, async (msg) => {
  const chatId = msg.chat.id;
  if (!(await ensureNotMaintenance(chatId))) return;
  const telegramId = String(msg.from?.id || '');
  if (!telegramId) {
    await bot.sendMessage(chatId, 'Could not identify your account.');
    return;
  }
  try {
    const res = await axios.get(`${BACKEND_BASE_URL}/api/users/balance/${telegramId}`, {
      validateStatus: (s) => s === 200 || s === 404,
    });
    if (res.status === 404) {
      await bot.sendMessage(chatId, 'You are not registered. Use /start to register first.');
      return;
    }
    const balance = res.data?.balance ?? 0;
    const reserved = res.data?.reservedAmount ?? 0;
    const available = res.data?.availableBalance ?? Math.max(0, balance - reserved);
    const msgText =
      reserved > 0
        ? `📊 Available: ${available} ETB\n🔒 Reserved: ${reserved} ETB\n💰 Current balance: ${balance} ETB`
        : `📊 Your balance: ${balance} ETB`;
    await bot.sendMessage(chatId, msgText);
  } catch (err) {
    console.error('Balance fetch error (/balance):', err?.response?.data || err.message);
    await bot.sendMessage(chatId, 'Unable to fetch balance. Please try again later.');
  }
});

// Callback: user selected a payment method — show instructions and wait for SMS/tx ID
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat?.id;
  const data = query.data || '';
  const telegramId = String(query.from?.id || '');
  if (!(await ensureNotMaintenance(chatId))) return;

  if (data.startsWith('deposit_pm_')) {
    const u = await ensureRegistered(chatId, telegramId);
    if (!u) {
      await bot.answerCallbackQuery(query.id).catch(() => {});
      return;
    }
    const id = data.replace('deposit_pm_', '');
    try {
      await bot.answerCallbackQuery(query.id);
      const res = await axios.get(`${BACKEND_BASE_URL}/api/payment-methods/${id}`, {
        validateStatus: (s) => s === 200,
      });
      const pm = res.data;
      if (!pm) {
        await bot.sendMessage(chatId, 'This payment method is no longer available.');
        return;
      }
      const emoji = pm.type === 'mobile_money' ? '📱' : '🏦';
      let instructionsText = `${emoji} ${pm.name} Deposit\n\n`;
      instructionsText += `Account Name: ${pm.accountName}\n`;
      instructionsText += `Account Number: ${pm.accountNumber}\n\n`;
      instructionsText += `Minimum Deposit: ${pm.minDeposit} Birr\n`;
      instructionsText += `Maximum Deposit: ${pm.maxDeposit} Birr\n\n`;
      instructionsText += '1. Send money to the account above.\n';
      instructionsText += `2. Deposits below ${pm.minDeposit} birr are not allowed.\n`;
      instructionsText += '3. After sending money, you will receive an SMS confirmation from the bank.\n';
      instructionsText += '4. Copy the full SMS message.\n';
      instructionsText += '5. Paste the SMS here to verify your deposit.\n';
      if (pm.instructions && pm.instructions.trim()) {
        instructionsText += `\n${pm.instructions.trim()}\n`;
      }

      try {
        await axios.post(`${BACKEND_BASE_URL}/api/deposit-requests`, {
          telegramId: String(query.from.id),
          paymentMethodId: pm._id,
        });
      } catch (createErr) {
        console.error('Create pending deposit error:', createErr?.response?.data || createErr.message);
        await bot.answerCallbackQuery(query.id).catch(() => {});
        await bot.sendMessage(chatId, 'Unable to start deposit. Please try again.').catch(() => {});
        return;
      }
      pendingDeposit[chatId] = { paymentMethodId: pm._id, paymentMethod: pm };
      await bot.sendMessage(chatId, instructionsText);
    } catch (err) {
      console.error('Payment method fetch error:', err?.response?.data || err.message);
      await bot.answerCallbackQuery(query.id).catch(() => {});
      await bot.sendMessage(chatId, 'Unable to load this option. Please try again.').catch(() => {});
    }
    return;
  }

  if (data.startsWith('withdraw_bank_')) {
    const bank = data.replace('withdraw_bank_', '');
    if (!['CBE', 'Telebirr'].includes(bank)) return;
    await bot.answerCallbackQuery(query.id);
    const w = pendingWithdraw[chatId];
    if (!w || w.step !== 'bank') return;
    w.bank = bank;
    w.step = 'account_number';
    await bot.sendMessage(chatId, 'Enter your account number :');
    return;
  }

  if (data === 'withdraw_confirm_yes') {
    await bot.answerCallbackQuery(query.id);
    const w = pendingWithdraw[chatId];
    if (!w || w.step !== 'confirm') return;
    delete pendingWithdraw[chatId];
    try {
      const res = await axios.post(`${BACKEND_BASE_URL}/api/withdrawal-requests`, {
        telegramId,
        amount: w.amount,
        bank: w.bank,
        accountNumber: w.accountNumber,
        accountHolderName: w.accountHolderName,
      });
      const d = res.data || {};
      const prev = d.previousBalance ?? w.balance;
      const next = d.newBalance ?? prev - w.amount;
      const txnId = d.transactionId || '';
      await bot.sendMessage(
        chatId,
        `✅ <b>Withdrawal request submitted</b>\n\nTransaction ID: ${txnId}\nAmount: ${w.amount} ETB\nBank: ${w.bank}\n\nPrevious balance: ${prev} ETB\nNew balance: ${next} ETB\n\nYour request is being processed. You will be notified when it is approved.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit withdrawal. Please try again.';
      await bot.sendMessage(chatId, msg);
    }
    return;
  }

  if (data === 'withdraw_confirm_no') {
    await bot.answerCallbackQuery(query.id);
    delete pendingWithdraw[chatId];
    await bot.sendMessage(chatId, 'Withdrawal cancelled.');
    return;
  }
});

// Main menu button handlers (basic placeholders)
bot.on('message', async (msg) => {
  // Ignore messages that are contact updates (already handled above)
  if (msg.contact) return;

  const chatId = msg.chat.id;
  const text = msg.text || '';
  const telegramId = String(msg.from?.id || '');
  if (!(await ensureNotMaintenance(chatId))) return;
  const isMainMenuText =
    text === '🎮 Play Bingo' ||
    text === '🔄 Refresh' ||
    text === '💰 Deposit' ||
    text === '💸 Withdraw' ||
    text === '📊 Balance' ||
    text === '📜 Bet History' ||
    text.trim().toLowerCase().startsWith('/menu');

  // /cancel — exit any pending flow
  if (text.trim().toLowerCase() === '/cancel') {
    delete pendingDeposit[chatId];
    delete pendingWithdraw[chatId];
    await bot.sendMessage(chatId, 'Cancelled.');
    return;
  }

  // If user taps any main menu action while in a flow, exit the flow first.
  // This prevents "Play Bingo" (etc.) from being interpreted as deposit/withdraw input.
  if (isMainMenuText && (pendingDeposit[chatId] || pendingWithdraw[chatId])) {
    delete pendingDeposit[chatId];
    delete pendingWithdraw[chatId];
  }

  // Withdrawal flow: handle by step (amount → bank → account_number → account_holder → confirm)
  if (pendingWithdraw[chatId]) {
    const w = pendingWithdraw[chatId];
    try {
      if (w.step === 'amount') {
        const num = parseFloat(text.replace(/,/g, '').trim());
        if (!Number.isFinite(num) || num < WITHDRAW_MIN_BIRR) {
          await bot.sendMessage(chatId, `Please enter a valid amount (minimum ${WITHDRAW_MIN_BIRR} ETB).`);
          return;
        }
        if (num > w.balance) {
          await bot.sendMessage(chatId, `Amount cannot exceed your balance (${w.balance} ETB). Please enter a valid amount.`);
          return;
        }
        w.amount = num;
        w.step = 'bank';
        await bot.sendMessage(chatId, 'Select your bank:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏦 CBE', callback_data: 'withdraw_bank_CBE' }],
              [{ text: '📱 Telebirr', callback_data: 'withdraw_bank_Telebirr' }],
            ],
          },
        });
        return;
      }
      if (w.step === 'account_number') {
        const accNum = text.trim().replace(/\s/g, '');
        if (!/^\d{8,20}$/.test(accNum)) {
          await bot.sendMessage(chatId, 'Please enter a valid account number (8–20 digits).');
          return;
        }
        w.accountNumber = accNum;
        w.step = 'account_holder';
        await bot.sendMessage(chatId, 'Enter the account holder name (as it appears on the account):');
        return;
      }
      if (w.step === 'account_holder') {
        const name = text.trim();
        if (name.length < 2 || name.length > 100) {
          await bot.sendMessage(chatId, 'Please enter a valid account holder name (2–100 characters).');
          return;
        }
        w.accountHolderName = name;
        w.step = 'confirm';
        const confirmText =
          `📋 <b>Confirm withdrawal</b>\n\n` +
          `Bank: ${w.bank}\n` +
          `Amount: ${w.amount} ETB\n` +
          `Account number: ${w.accountNumber}\n` +
          `Account holder: ${w.accountHolderName}\n\n` +
          `Is this correct?`;
        await bot.sendMessage(chatId, confirmText, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Yes', callback_data: 'withdraw_confirm_yes' }, { text: '❌ No', callback_data: 'withdraw_confirm_no' }],
            ],
          },
        });
        return;
      }
    } catch (e) {
      console.error('Withdrawal step error:', e?.response?.data || e.message);
      await bot.sendMessage(chatId, 'Something went wrong. Type /cancel to cancel or try again.');
    }
    return;
  }

  // If user is in deposit flow, their message is the pasted SMS — verify against ForwardedSms.
  // But if they tap a main menu button (/menu, Play, Deposit, Withdraw, Balance), exit the flow instead.
  if (pendingDeposit[chatId] && !isMainMenuText) {
    const pending = pendingDeposit[chatId];
    try {
      const verifyRes = await axios.post(`${BACKEND_BASE_URL}/api/deposit-requests/verify`, {
        sms: text.trim(),
        telegramId,
        paymentMethodId: pending.paymentMethodId,
      });
      const data = verifyRes.data || {};
      const newBalance = data.deposit?.user?.balance;
      let reply = '✅ Deposit approved. Your balance has been credited.';
      if (newBalance != null) reply += `\n📊 New balance: ${newBalance} ETB`;
      await bot.sendMessage(chatId, reply);
      delete pendingDeposit[chatId];
    } catch (err) {
      console.error('Deposit verify error:', err?.response?.data || err.message);
      const code = err.response?.data?.code;
      const supportContact = err.response?.data?.supportContact || '@esubingosupport1';
      const isVerificationFailed =
        code === 'NO_MATCH_OR_ALREADY_USED' || code === 'PARSE_FAILED' || code === 'MISSING_SMS';
      let msg;
      if (isVerificationFailed) {
        msg =
          '❌ Payment Verification Failed\n\n' +
          'Error: Transaction not found or already verified. Please check the transaction number.\n\n' +
          '📝 Please make sure you\'re pasting the full SMS message or the correct transaction number.\n\n' +
          `💬 Need help? Contact ${supportContact}\n\n` +
          '📤 You can paste another SMS below:';
      } else {
        msg =
          err.response?.data?.message ||
          'Verification failed. Please ensure you pasted the full bank SMS and that the payment was received. Try again or contact support.';
      }
      await bot.sendMessage(chatId, msg);
      // Keep pendingDeposit[chatId] so user can paste another SMS (only clear on success)
    }
    return;
  } else if (pendingDeposit[chatId] && isMainMenuText) {
    // User chose to go back to main menu instead of pasting another SMS
    delete pendingDeposit[chatId];
  }

  try {
    if (text === '🔄 Refresh') {
      const u = await ensureRegistered(chatId, telegramId);
      if (!u) return;
      try {
        const gamesText = await buildGamesListMessage();
        await bot.sendMessage(chatId, gamesText, { parse_mode: 'HTML', ...mainMenuKeyboard });
      } catch (e) {
        console.error('Refresh error:', e?.response?.data || e.message);
        await bot.sendMessage(chatId, 'Could not refresh the game list. Try again in a moment.');
      }
    } else if (text === '🎮 Play Bingo') {
      const u = await ensureRegistered(chatId, telegramId);
      if (!u) return;
      if (!GAME_WEBAPP_URL || !GAME_WEBAPP_URL.startsWith('https://')) {
        await bot.sendMessage(
          chatId,
          'Mini App is not configured. Set GAME_WEBAPP_URL (HTTPS) in .env, e.g. your ngrok URL.'
        );
      } else {
        const base = GAME_WEBAPP_URL.trim().replace(/\/+$/, '');
        const webAppUrl = `${base}?telegramId=${encodeURIComponent(telegramId)}`;
        await bot.sendMessage(chatId, 'Open the game to play Bingo:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Play Now', web_app: { url: webAppUrl } }],
            ],
          },
        });
      }
    } else if (text === '💰 Deposit') {
      const u = await ensureRegistered(chatId, telegramId);
      if (!u) return;
      try {
        const res = await axios.get(`${BACKEND_BASE_URL}/api/payment-methods`, {
          params: { enabled: 'true' },
          validateStatus: (s) => s === 200,
        });
        const methods = Array.isArray(res.data) ? res.data : [];
        if (methods.length === 0) {
          await bot.sendMessage(chatId, 'No deposit methods are available at the moment. Please try again later.');
          return;
        }
        const rows = methods.map((m) => [
          {
            text: `${m.type === 'mobile_money' ? '📱' : '🏦'} ${m.name}`,
            callback_data: `deposit_pm_${m._id}`,
          },
        ]);
        await bot.sendMessage(chatId, '💳 Choose payment method:', {
          reply_markup: { inline_keyboard: rows },
        });
      } catch (err) {
        console.error('Deposit methods fetch error:', err?.response?.data || err.message);
        await bot.sendMessage(chatId, 'Unable to load deposit options. Please try again later.');
      }
    } else if (text === '💸 Withdraw') {
      const u = await ensureRegistered(chatId, telegramId);
      if (!u) return;
      try {
        const balanceRes = await axios.get(`${BACKEND_BASE_URL}/api/users/balance/${telegramId}`, {
          validateStatus: (s) => s === 200 || s === 404,
        });
        if (balanceRes.status === 404) {
          await bot.sendMessage(chatId, 'You are not registered. Use /start to register first.');
          return;
        }
        const balance = balanceRes.data?.balance ?? 0;
        const reserved = balanceRes.data?.reservedAmount ?? 0;
        const available = balanceRes.data?.availableBalance ?? Math.max(0, balance - reserved);
        if (available < WITHDRAW_MIN_BIRR) {
          await bot.sendMessage(
            chatId,
            `Minimum available balance to withdraw is ${WITHDRAW_MIN_BIRR} Birr.\n\nYour available balance: ${available} ETB`
          );
          return;
        }
        const myRes = await axios.get(`${BACKEND_BASE_URL}/api/withdrawal-requests/my`, {
          params: { telegramId },
          validateStatus: (s) => s === 200,
        });
        if (myRes.data) {
          await bot.sendMessage(
            chatId,
            `You already have a pending withdrawal (${myRes.data.amount} ETB). Please wait for it to be processed.`
          );
          return;
        }
        pendingWithdraw[chatId] = { step: 'amount', balance: available, amount: null, bank: null, accountNumber: null, accountHolderName: null };
        const reservedLine = reserved > 0 ? `\nReserved: ${reserved} ETB` : '';
        await bot.sendMessage(
          chatId,
          `💸 <b>Withdraw</b>\n\nAvailable: ${available} ETB${reservedLine}\nCurrent balance: ${balance} ETB\n\nEnter the amount you want to withdraw (minimum ${WITHDRAW_MIN_BIRR} ETB, maximum ${available} ETB):\n\nType /cancel to cancel.`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        console.error('Withdraw start error:', err?.response?.data || err.message);
        await bot.sendMessage(chatId, 'Unable to start withdrawal. Please try again later.');
      }
    } else if (text === '📊 Balance') {
      if (!telegramId) {
        await bot.sendMessage(chatId, 'Could not identify your account.');
        return;
      }
      const u = await ensureRegistered(chatId, telegramId);
      if (!u) return;
      try {
        const res = await axios.get(`${BACKEND_BASE_URL}/api/users/balance/${telegramId}`, {
          validateStatus: (s) => s === 200 || s === 404,
        });
        if (res.status === 404) {
          await bot.sendMessage(chatId, 'You are not registered. Use /start to register first.');
          return;
        }
        const balance = res.data?.balance ?? 0;
        const reserved = res.data?.reservedAmount ?? 0;
        const available = res.data?.availableBalance ?? Math.max(0, balance - reserved);
        const msgText =
          reserved > 0
            ? `📊 Available: ${available} ETB\n🔒 Reserved: ${reserved} ETB\n💰 Current balance: ${balance} ETB`
            : `📊 Your balance: ${balance} ETB`;
        await bot.sendMessage(chatId, msgText);
      } catch (err) {
        console.error('Balance fetch error:', err?.response?.data || err.message);
        await bot.sendMessage(chatId, 'Unable to fetch balance. Please try again later.');
      }
    } else if (text === '📜 Bet History') {
      if (!telegramId) {
        await bot.sendMessage(chatId, 'Could not identify your account.');
        return;
      }
      const u = await ensureRegistered(chatId, telegramId);
      if (!u) return;
      try {
        const res = await axios.get(`${BACKEND_BASE_URL}/api/bets/history/by-telegram/${telegramId}`, {
          params: { limit: 10 },
          validateStatus: (s) => s === 200 || s === 404,
        });
        if (res.status === 404) {
          await bot.sendMessage(chatId, 'You are not registered. Use /start to register first.');
          return;
        }
        const { bets = [], total, profitLoss } = res.data || {};
        const formatDate = (d) => {
          if (!d) return '—';
          const dt = new Date(d);
          return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        };
        let msg = '📜 <b>Bet History</b> (last 10)\n\n';
        if (bets.length === 0) {
          msg += 'No bets yet. Join a game and select a cartela to place a bet.';
        } else {
          bets.forEach((b, i) => {
            const gameId = b.gameId?._id ? String(b.gameId._id).slice(-6) : '?';
            const betAmount = b.betAmount ?? 0;
            const status = b.status ?? '—';
            const prize = b.prize ?? 0;
            const date = formatDate(b.createdAt);
            msg += `${i + 1}. Game #${gameId} | ${betAmount} ETB | ${status} | Prize: ${prize} ETB | ${date}\n`;
          });
          msg += `\nTotal bets: ${total}`;
          if (typeof profitLoss === 'number') {
            msg += `\n📊 Profit/Loss: ${profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)} ETB`;
          }
        }
        await bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('Bet history fetch error:', err?.response?.data || err.message);
        await bot.sendMessage(chatId, 'Unable to load bet history. Please try again later.');
      }
    }
  } catch (error) {
    console.error('Error handling main menu action:', error?.response?.data || error.message);
  }
});

