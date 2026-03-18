const express = require('express');
const DepositRequest = require('../models/DepositRequest');
const ForwardedSms = require('../models/ForwardedSms');
const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');
const Settings = require('../models/Settings');
const getSettings = Settings.getSettings;
const {
  parseTransactionSMS,
  parseSMS,
  normalizeTransactionIdForMatch,
  EXTRACT_ERROR_MESSAGE,
} = require('../utils/smsParser');

const router = express.Router();

// POST /api/deposit-requests — create pending (no message) or submit with SMS
// Body: { telegramId, paymentMethodId, message? } — if message omitted, creates pending for later verify
router.post('/', async (req, res) => {
  try {
    const { telegramId, paymentMethodId, message } = req.body || {};
    if (!telegramId || !paymentMethodId) {
      return res.status(400).json({
        message: 'telegramId and paymentMethodId are required',
      });
    }
    const user = await User.findOne({ telegramId: String(telegramId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const pm = await PaymentMethod.findById(paymentMethodId).lean();
    if (!pm) return res.status(400).json({ message: 'Invalid payment method' });

    const msg = typeof message === 'string' ? message.trim() : '';
    if (!msg) {
      const doc = await DepositRequest.create({
        user: user._id,
        paymentMethod: paymentMethodId,
        message: '',
        status: 'pending',
      });
      const populated = await DepositRequest.findById(doc._id)
        .populate('paymentMethod', 'name type accountNumber minDeposit maxDeposit')
        .populate('user', 'telegramId username phone')
        .lean();
      return res.status(201).json(populated);
    }

    const parsed = parseTransactionSMS(msg);
    if (!parsed) {
      return res.status(400).json({
        message: EXTRACT_ERROR_MESSAGE,
        code: 'PARSE_FAILED',
      });
    }
    const { amount, transactionId } = parsed;

    const duplicate = await DepositRequest.findOne({ transactionId }).lean();
    if (duplicate) {
      return res.status(400).json({
        message: 'Duplicate transaction ID. This transaction has already been submitted.',
        code: 'DUPLICATE_TRANSACTION',
      });
    }

    const min = Number(pm.minDeposit) || 0;
    const max = Number(pm.maxDeposit) || 0;
    if (amount < min || amount > max) {
      return res.status(400).json({
        message: `Amount must be between ${min} and ${max} ETB for this payment method.`,
        code: 'AMOUNT_OUT_OF_RANGE',
      });
    }

    const doc = await DepositRequest.create({
      user: user._id,
      paymentMethod: paymentMethodId,
      message: msg,
      amount,
      transactionId,
      status: 'pending',
    });
    const populated = await DepositRequest.findById(doc._id)
      .populate('paymentMethod', 'name type accountNumber')
      .populate('user', 'telegramId username phone')
      .lean();
    return res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.transactionId) {
      return res.status(400).json({
        message: 'Duplicate transaction ID. This transaction has already been submitted.',
        code: 'DUPLICATE_TRANSACTION',
      });
    }
    console.error('Error creating deposit request', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Only store SMS when source is one of these (from body.source or first line of message).
const ALLOWED_SMS_SOURCES = [
  'Incoming - CBE (Cbe (Mobile))',
  'Incoming - 127 (Tele (Mobile))',
];

function normalizeSourceForMatch(s) {
  if (typeof s !== 'string') return '';
  return s.trim().toLowerCase();
}

// App sends: { subject, text, number }. text can be "Incoming - 127 (Tele (Mobile))<br/>Message: Dear Solomon \nYou have received ETB..."
function detectSourceFromMessage(fullMessage) {
  if (!fullMessage || typeof fullMessage !== 'string') return { source: null, body: fullMessage };
  const trimmed = fullMessage.trim();
  const firstLine = trimmed.split(/\r?\n/)[0].trim();
  // First line may contain "<br/>" e.g. "Incoming - 127 (Tele (Mobile))<br/>Message: Dear Solomon"
  const sourcePart = firstLine.split(/<br\s*\/?>/i)[0].trim();
  const normalizedFirst = normalizeSourceForMatch(sourcePart);
  for (const allowed of ALLOWED_SMS_SOURCES) {
    if (normalizedFirst === normalizeSourceForMatch(allowed)) {
      const afterSourceInFirstLine = firstLine.slice(sourcePart.length).replace(/^<br\s*\/?>\s*/i, '').trim();
      const restOfLines = trimmed.slice(firstLine.length).replace(/^\r?\n+/, '').trim();
      const body = afterSourceInFirstLine ? (restOfLines ? `${afterSourceInFirstLine}\n${restOfLines}` : afterSourceInFirstLine) : restOfLines;
      return { source: allowed, body: body || trimmed };
    }
  }
  return { source: null, body: trimmed };
}

// Only store credit/received SMS (money in). Do not store transfer/debited (money out).
// Telebirr: "You have received ETB" = credit; "You have transferred ETB" = debit.
// CBE: "Credited with ETB" = credit; "You have transfered ETB" = debit.
function isCreditSms(messageBody) {
  if (!messageBody || typeof messageBody !== 'string') return false;
  const t = messageBody.toLowerCase();
  if (t.includes('you have transferred etb') || t.includes('you have transfered etb')) return false;
  if (t.includes('you have received etb')) return true;
  if (t.includes('credited with etb') || t.includes('has been credited with etb')) return true;
  return false;
}

// POST /api/deposit-requests/sms-webhook — receive forwarded SMS from admin/forwarder device; store in ForwardedSms only
// App payload: { subject: "...", text: "Incoming - 127 (Tele (Mobile))<br/>Message: ...", number: "127" }. We use body.text (or message/sms).
// Only stores when source is "Incoming - CBE (Cbe (Mobile))" or "Incoming - 127 (Tele (Mobile))" (from body.source or start of text).
// Stored smsText: "Incoming - CBE (Cbe (Mobile)) <br/>Message: ..."
// Optional auth: set SMS_WEBHOOK_SECRET in .env and send X-SMS-Webhook-Secret header or body secret
router.post('/sms-webhook', async (req, res) => {
  try {
    const secret = process.env.SMS_WEBHOOK_SECRET;
    if (secret) {
      const headerSecret = req.headers['x-sms-webhook-secret'];
      const bodySecret = req.body?.secret;
      if (headerSecret !== secret && bodySecret !== secret) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
    }

    const raw = (req.body && (req.body.text ?? req.body.message ?? req.body.sms)) || '';
    const fullMessage = typeof raw === 'string' ? raw.trim() : '';
    if (!fullMessage) {
      return res.status(400).json({
        message: 'SMS content is required. Send { "message": "<full SMS text>" }.',
        code: 'MISSING_MESSAGE',
      });
    }

    let source = null;
    let messageBody = fullMessage;

    const bodySource = typeof req.body?.source === 'string' ? req.body.source.trim() : '';
    if (bodySource) {
      const normalized = normalizeSourceForMatch(bodySource);
      const matched = ALLOWED_SMS_SOURCES.find((a) => normalizeSourceForMatch(a) === normalized);
      if (matched) source = matched;
    }
    if (!source) {
      const detected = detectSourceFromMessage(fullMessage);
      source = detected.source;
      messageBody = detected.body;
    }
    if (!source) {
      const normalizedFirst = normalizeSourceForMatch(fullMessage.split(/\r?\n/)[0] || '');
      const hasAllowedFirstLine = ALLOWED_SMS_SOURCES.some((a) => normalizeSourceForMatch(a) === normalizedFirst);
      return res.status(200).json({
        message: hasAllowedFirstLine
          ? 'SMS not stored (could not parse transaction from message body).'
          : 'SMS not stored (source not allowed). Only CBE and Tele (Mobile) are stored.',
        stored: false,
        allowedSources: ALLOWED_SMS_SOURCES,
      });
    }

    if (!isCreditSms(messageBody)) {
      return res.status(200).json({
        message: 'SMS not stored (only received/credited SMS are stored; transfer/debited are ignored).',
        stored: false,
      });
    }

    const parsed = parseTransactionSMS(messageBody);
    if (!parsed) {
      return res.status(400).json({
        message: EXTRACT_ERROR_MESSAGE,
        code: 'PARSE_FAILED',
      });
    }
    const { transactionId, amount, senderName, timestamp } = parsed;

    const smsText = `${source} <br/>${messageBody}`;

    const doc = await ForwardedSms.create({
      smsText,
      transactionId: normalizeTransactionIdForMatch(transactionId) || transactionId,
      amount,
      senderName: senderName || null,
      timestamp: timestamp || null,
      used: false,
    });
    return res.status(201).json({
      message: 'SMS stored for verification.',
      stored: true,
      id: doc._id,
      transactionId: doc.transactionId,
      amount: doc.amount,
    });
  } catch (err) {
    console.error('Error in SMS webhook', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/deposit-requests/verify — match pasted SMS with ForwardedSms (transactionId + amount, used=false); approve deposit
// Body (player): { sms: "<full SMS>", telegramId, paymentMethodId }
// Body (admin):  { sms: "..." } or { receiverMessage: "..." } — finds any pending deposit with same amount
// CBE matching: first 12 chars of transaction ID. Reject if ForwardedSms not found or already used.
router.post('/verify', async (req, res) => {
  try {
    const { sms, receiverMessage, telegramId, paymentMethodId } = req.body || {};
    const smsText = (typeof sms === 'string' ? sms : typeof receiverMessage === 'string' ? receiverMessage : '').trim();
    const settings = await getSettings();
    const supportContact = settings.supportContact || '@esubingosupport1';

    if (!smsText) {
      return res.status(400).json({
        message: 'SMS content is required. Send { "sms": "<full SMS text>" } or { "receiverMessage": "..." }.',
        code: 'MISSING_SMS',
        supportContact,
      });
    }

    const parsed = parseTransactionSMS(smsText);
    if (!parsed) {
      return res.status(400).json({
        message: EXTRACT_ERROR_MESSAGE,
        code: 'PARSE_FAILED',
        supportContact,
      });
    }
    const { transactionId, amount } = parsed;
    const txnNorm = normalizeTransactionIdForMatch(transactionId) || transactionId;

    const forwarded = await ForwardedSms.findOne({
      transactionId: txnNorm,
      amount,
      used: false,
    }).lean();
    if (!forwarded) {
      return res.status(400).json({
        message: 'No matching bank confirmation found, or this SMS was already used. Ensure the SMS was forwarded to the webhook first.',
        code: 'NO_MATCH_OR_ALREADY_USED',
        supportContact,
      });
    }

    let pending;
    if (telegramId && paymentMethodId) {
      const user = await User.findOne({ telegramId: String(telegramId) });
      if (!user) return res.status(404).json({ message: 'User not found' });
      pending = await DepositRequest.findOne({
        user: user._id,
        paymentMethod: paymentMethodId,
        status: 'pending',
      })
        .sort({ createdAt: -1 })
        .populate('paymentMethod');
      if (!pending) {
        return res.status(400).json({
          message: 'No pending deposit for this payment method. Start a deposit from the bot first.',
          code: 'NO_PENDING_DEPOSIT',
        });
      }
    } else {
      pending = await DepositRequest.findOne({ status: 'pending', amount })
        .sort({ createdAt: 1 })
        .populate('paymentMethod')
        .populate('user');
      if (!pending) {
        return res.status(400).json({
          message: 'No pending deposit found with this amount.',
          code: 'NO_PENDING_DEPOSIT',
        });
      }
      const min = Number(pending.paymentMethod?.minDeposit) || 0;
      const max = Number(pending.paymentMethod?.maxDeposit) || 0;
      if (amount < min || amount > max) {
        return res.status(400).json({
          message: `Amount must be between ${min} and ${max} ETB for this payment method.`,
          code: 'AMOUNT_OUT_OF_RANGE',
        });
      }
    }

    const min = Number(pending.paymentMethod?.minDeposit) || 0;
    const max = Number(pending.paymentMethod?.maxDeposit) || 0;
    if (amount < min || amount > max) {
      return res.status(400).json({
        message: `Amount must be between ${min} and ${max} ETB for this payment method.`,
        code: 'AMOUNT_OUT_OF_RANGE',
      });
    }

    const existingWithTxn = await DepositRequest.findOne({
      transactionId: txnNorm,
      _id: { $ne: pending._id },
    }).lean();
    if (existingWithTxn) {
      return res.status(400).json({
        message: 'This transaction has already been used for another deposit.',
        code: 'DUPLICATE_TRANSACTION',
      });
    }

    const updated = await DepositRequest.findByIdAndUpdate(
      pending._id,
      {
        $set: {
          message: smsText,
          amount,
          transactionId: txnNorm,
          status: 'approved',
          reviewedAt: new Date(),
          verifiedBy: telegramId ? 'sms_webhook' : 'receiver_sms',
          receiverSms: smsText,
        },
      },
      { returnDocument: 'after' }
    )
      .populate('paymentMethod', 'name type')
      .populate('user', 'telegramId username balance')
      .lean();

    await ForwardedSms.findByIdAndUpdate(forwarded._id, { $set: { used: true } });

    const userId = updated?.user?._id || updated?.user || pending.user?._id || pending.user;
    if (userId) await User.findByIdAndUpdate(userId, { $inc: { balance: amount } });

    return res.json({
      message: 'Deposit approved. Balance has been credited.',
      deposit: updated,
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.transactionId) {
      return res.status(400).json({
        message: 'This transaction has already been used for another deposit.',
        code: 'DUPLICATE_TRANSACTION',
      });
    }
    console.error('Error verifying deposit', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/deposit-requests — list for admin
// Query: status, paymentMethodId, dateFrom, dateTo (ISO date strings)
router.get('/', async (req, res) => {
  try {
    const { status, paymentMethodId, dateFrom, dateTo } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (paymentMethodId) query.paymentMethod = paymentMethodId;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    const list = await DepositRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('paymentMethod', 'name type accountNumber minDeposit maxDeposit')
      .populate('user', 'telegramId username phone balance')
      .lean();
    return res.json(list);
  } catch (err) {
    console.error('Error listing deposit requests', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/deposit-requests/:id — manual approve or reject
// Approve: atomic balance update with $inc
router.patch('/:id', async (req, res) => {
  try {
    const { status, amount: approvedAmount } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }
    const doc = await DepositRequest.findById(req.params.id).populate('user');
    if (!doc) return res.status(404).json({ message: 'Deposit request not found' });
    if (doc.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    const creditAmount = approvedAmount != null ? Number(approvedAmount) : doc.amount;
    if (status === 'approved' && creditAmount > 0 && doc.user) {
      doc.amount = creditAmount;
      await User.findByIdAndUpdate(doc.user._id, {
        $inc: { balance: creditAmount },
      });
    }

    doc.status = status;
    doc.reviewedAt = new Date();
    doc.verifiedBy = 'manual';
    await doc.save();

    const updated = await DepositRequest.findById(doc._id)
      .populate('paymentMethod', 'name type')
      .populate('user', 'telegramId username balance')
      .lean();
    return res.json(updated);
  } catch (err) {
    console.error('Error updating deposit request', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
