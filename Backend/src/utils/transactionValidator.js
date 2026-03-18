/**
 * Transaction validator: validates money transfers using sender (outgoing) and receiver (incoming) SMS
 * from CBE or Telebirr. Extracts and compares amounts, transaction IDs, timestamps, and parties.
 */

// CBE sender: URL id=FT26074YKC1903699717 → use first 12 chars (FT26074YKC19) to match receiver Ref No
const CBE_SENDER_ID_URL = /(?:apps\.cbe\.com\.et[^?]*\?id=|id=)([A-Za-z0-9]{12,})/i;
const CBE_REF_NO = /Ref\s+No\s+([A-Za-z0-9]+)/i;
const TELEBIRR_TXN_NUMBER = /Your transaction number is\s*([A-Z0-9]+)/i;

// Amount: exact phrases from SMS (CBE uses "transfered", Telebirr uses "transferred")
const CBE_SENDER_AMOUNT = /You have transfered ETB\s*([\d.]+)/i;
const CBE_RECEIVER_AMOUNT = /(?:has been )?Credited with ETB\s*([\d.]+)/i;
const TELEBIRR_SENDER_AMOUNT = /You have transferred ETB\s*([\d.]+)/i;
const TELEBIRR_RECEIVER_AMOUNT = /You have received ETB\s*([\d.]+)/i;
const ETB_AMOUNT_GENERIC = /ETB\s*([\d,.]+\d)/i;

// Timestamp: DD/MM/YYYY at HH:MM:SS or DD/MM/YYYY HH:MM:SS or YYYY-MM-DD HH:MM:SS
const TIMESTAMP_DM_AT = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+at\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/;
const TIMESTAMP_DM = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/;
const TIMESTAMP_ISO = /(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/;

// Telebirr: "from X" / "to X"
const TELEBIRR_FROM = /(?:received|from)\s+ETB[^.]*\.\s*from\s+([^.]+?)\s+on/i;
const TELEBIRR_TO = /(?:sent|to)\s+ETB[^.]*\.?\s*to\s+([^.]+?)\s+on/i;
const TELEBIRR_RECEIVED_FROM = /from\s+([^.]+?)\s+on\s+\d/i;
const TELEBIRR_SENT_TO = /to\s+([^.]+?)\s+on\s+\d/i;

// CBE: "Dear X" (receiver), "from X" (sender)
const CBE_DEAR = /Dear\s+([^,]+?)(?:,| your)/i;
const CBE_FROM = /from\s+([^ with]+?)\s+with\s+Ref/i;
const CBE_CREDITED_FROM = /(?:Credited|credited)\s+with[^f]*from\s+([^w]+?)\s+with/i;

// Fees: CBE "S.charge of ETB 0.50", "VAT(15%) of ETB0.08", "Disaster Fund (5%) of ETB0.03"; Telebirr "service fee is ETB 1.74", "15% VAT ... ETB 0.26"
const FEE_SERVICE = /(?:S\.?charge|service\s*fee)[^E]*ETB\s*([\d.]+)/i;
const FEE_VAT = /VAT[^(]*\([^)]*\)[^E]*ETB\s*([\d.]+)|VAT[:\s]*ETB\s*([\d.]+)/i;
const FEE_DISASTER = /Disaster\s*Fund[^E]*ETB\s*([\d.]+)/i;

function normalizeAmount(str) {
  if (str == null) return null;
  const n = parseFloat(String(str).replace(/,/g, ''));
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

function extractAmountFromSender(text, provider) {
  if (!text || typeof text !== 'string') return null;
  if (provider === 'cbe') {
    const m = text.match(CBE_SENDER_AMOUNT);
    return m ? normalizeAmount(m[1]) : null;
  }
  if (provider === 'telebirr') {
    const m = text.match(TELEBIRR_SENDER_AMOUNT);
    return m ? normalizeAmount(m[1]) : null;
  }
  return null;
}

function extractAmountFromReceiver(text, provider) {
  if (!text || typeof text !== 'string') return null;
  if (provider === 'cbe') {
    const m = text.match(CBE_RECEIVER_AMOUNT);
    return m ? normalizeAmount(m[1]) : null;
  }
  if (provider === 'telebirr') {
    const m = text.match(TELEBIRR_RECEIVER_AMOUNT);
    return m ? normalizeAmount(m[1]) : null;
  }
  return null;
}

function extractAmount(text) {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(CBE_SENDER_AMOUNT) || text.match(CBE_RECEIVER_AMOUNT) ||
    text.match(TELEBIRR_SENDER_AMOUNT) || text.match(TELEBIRR_RECEIVER_AMOUNT) || text.match(ETB_AMOUNT_GENERIC);
  if (!m || !m[1]) return null;
  return normalizeAmount(m[1]);
}

function normalizeTimestamp(text) {
  if (!text || typeof text !== 'string') return null;
  let m = text.match(TIMESTAMP_DM_AT) || text.match(TIMESTAMP_DM);
  if (m) {
    const [, d, mo, y, h, min, s] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')} ${h.padStart(2, '0')}:${min.padStart(2, '0')}:${s.padStart(2, '0')}`;
  }
  m = text.match(TIMESTAMP_ISO);
  if (m) return m[0];
  return null;
}

function extractTimestamp(text) {
  if (!text || typeof text !== 'string') return null;
  return normalizeTimestamp(text);
}

function extractFees(text) {
  const fees = { service_charge: null, VAT: null, disaster_fund: null };
  if (!text || typeof text !== 'string') return fees;
  const sc = text.match(FEE_SERVICE);
  if (sc) fees.service_charge = normalizeAmount(sc[1]);
  const vat = text.match(FEE_VAT);
  if (vat) fees.VAT = normalizeAmount(vat[1] || vat[2]);
  const df = text.match(FEE_DISASTER);
  if (df) fees.disaster_fund = normalizeAmount(df[1]);
  return fees;
}

/**
 * Detect provider and parse sender (outgoing) message.
 * @returns {object|null} { provider, sender_name, receiver_name, sender_account, receiver_account, amount, transaction_id, timestamp, fees } or null
 */
function parseSenderMessage(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  let provider = null;
  let transaction_id = null;

  if (CBE_SENDER_ID_URL.test(t)) {
    provider = 'cbe';
    const idMatch = t.match(CBE_SENDER_ID_URL);
    if (idMatch && idMatch[1]) {
      const fullId = idMatch[1].trim();
      transaction_id = fullId.length >= 12 ? fullId.slice(0, 12) : fullId;
    }
  }
  if (!provider && /You have transfered ETB/i.test(t)) provider = 'cbe';
  if (TELEBIRR_TXN_NUMBER.test(t) && /You have transferred/i.test(t)) {
    provider = 'telebirr';
    const txMatch = t.match(TELEBIRR_TXN_NUMBER);
    transaction_id = txMatch ? txMatch[1].trim() : null;
  }
  if (!provider) return null;

  const amount = extractAmountFromSender(t, provider) ?? extractAmount(t);
  const timestamp = extractTimestamp(t);
  const fees = extractFees(t);

  let sender_name = null;
  let receiver_name = null;
  let sender_account = null;
  let receiver_account = null;

  if (provider === 'telebirr') {
    receiver_name = (t.match(TELEBIRR_SENT_TO) || [])[1]?.trim() || null;
    sender_name = null;
  }
  if (provider === 'cbe') {
    const toMatch = t.match(/You have transfered ETB[^t]*to\s+([^.]+?)\s+on/i);
    receiver_name = toMatch ? toMatch[1].trim() : null;
    sender_name = (t.match(/Dear\s+([^,]+),/i) || [])[1]?.trim() || null;
  }

  return {
    provider,
    sender_name: sender_name || null,
    receiver_name: receiver_name || null,
    sender_account: sender_account || null,
    receiver_account: receiver_account || null,
    amount,
    transaction_id,
    timestamp,
    fees,
  };
}

/**
 * Detect provider and parse receiver (incoming) message.
 */
function parseReceiverMessage(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  let provider = null;
  let transaction_id = null;

  if (CBE_REF_NO.test(t) || /Credited with ETB/i.test(t)) {
    provider = 'cbe';
    const refMatch = t.match(CBE_REF_NO);
    transaction_id = refMatch ? refMatch[1].trim() : null;
  }
  if (TELEBIRR_TXN_NUMBER.test(t) && /You have received/i.test(t)) {
    provider = 'telebirr';
    const txMatch = t.match(TELEBIRR_TXN_NUMBER);
    transaction_id = txMatch ? txMatch[1].trim() : null;
  }
  if (!provider) return null;

  const amount = extractAmountFromReceiver(t, provider) ?? extractAmount(t);
  const timestamp = extractTimestamp(t);
  const fees = extractFees(t);

  let sender_name = null;
  let receiver_name = null;
  let sender_account = null;
  let receiver_account = null;

  if (provider === 'telebirr') {
    sender_name = (t.match(TELEBIRR_RECEIVED_FROM) || t.match(TELEBIRR_FROM) || [])[1]?.trim() || null;
    receiver_name = null;
  }
  if (provider === 'cbe') {
    receiver_name = (t.match(CBE_DEAR) || [])[1]?.trim() || null;
    sender_name = (t.match(/from\s+([^,]+?),?\s+on/i) || t.match(CBE_FROM) || [])[1]?.trim() || null;
  }

  return {
    provider,
    sender_name: sender_name || null,
    receiver_name: receiver_name || null,
    sender_account: sender_account || null,
    receiver_account: receiver_account || null,
    amount,
    transaction_id,
    timestamp,
    fees,
  };
}

/**
 * Compare transaction IDs: Telebirr exact match, CBE first 12 characters of sender ID with receiver Ref No.
 */
function transactionIdsMatch(provider, senderId, receiverId) {
  if (!senderId || !receiverId) return false;
  const s = String(senderId).trim();
  const r = String(receiverId).trim();
  if (provider === 'telebirr') return s === r;
  if (provider === 'cbe') return s.slice(0, 12) === r.slice(0, 12);
  return false;
}

/**
 * Validate one transaction using sender (outgoing) and receiver (incoming) SMS.
 * @param {string} senderMessage - Outgoing transfer SMS
 * @param {string} receiverMessage - Incoming transfer SMS
 * @returns {object} { valid, transaction, reason }
 */
function validateTransaction(senderMessage, receiverMessage) {
  const invalid = (reason) => ({
    valid: false,
    transaction: null,
    reason,
  });

  const sender = parseSenderMessage(senderMessage);
  const receiver = parseReceiverMessage(receiverMessage);

  if (!sender) {
    return invalid('Could not parse sender (outgoing) message. Ensure it is from CBE or Telebirr.');
  }
  if (!receiver) {
    return invalid('Could not parse receiver (incoming) message. Ensure it is from CBE or Telebirr.');
  }
  if (sender.provider !== receiver.provider) {
    return invalid(`Provider mismatch: sender is ${sender.provider}, receiver is ${receiver.provider}. Both must be the same provider.`);
  }

  const provider = sender.provider;

  if (sender.amount == null || receiver.amount == null) {
    return invalid('Could not extract amount from one or both messages.');
  }
  if (sender.amount !== receiver.amount) {
    return invalid(`Amount mismatch: sender ${sender.amount} ETB vs receiver ${receiver.amount} ETB.`);
  }

  if (!transactionIdsMatch(provider, sender.transaction_id, receiver.transaction_id)) {
    return invalid(
      provider === 'cbe'
        ? 'CBE transaction ID mismatch: first 12 characters of sender ID do not match receiver Ref No.'
        : 'Telebirr transaction ID mismatch: transaction numbers do not match exactly.'
    );
  }

  if (sender.timestamp && receiver.timestamp && sender.timestamp !== receiver.timestamp) {
    return invalid(`Timestamp mismatch: sender "${sender.timestamp}" vs receiver "${receiver.timestamp}".`);
  }

  const transaction_id = sender.transaction_id || receiver.transaction_id;
  const timestamp = sender.timestamp || receiver.timestamp || null;
  const amount = sender.amount;
  const fees = {
    service_charge: sender.fees?.service_charge ?? receiver.fees?.service_charge ?? null,
    VAT: sender.fees?.VAT ?? receiver.fees?.VAT ?? null,
    disaster_fund: sender.fees?.disaster_fund ?? receiver.fees?.disaster_fund ?? null,
  };

  return {
    valid: true,
    transaction: {
      sender_name: sender.sender_name || receiver.sender_name || '',
      sender_account: sender.sender_account || receiver.sender_account || '',
      receiver_name: sender.receiver_name || receiver.receiver_name || '',
      receiver_account: sender.receiver_account || receiver.receiver_account || '',
      amount,
      transaction_id: transaction_id || '',
      timestamp: timestamp || '',
      fees: {
        service_charge: fees.service_charge ?? null,
        VAT: fees.VAT ?? null,
        disaster_fund: fees.disaster_fund ?? null,
      },
    },
    reason: null,
  };
}

module.exports = {
  validateTransaction,
  parseSenderMessage,
  parseReceiverMessage,
  transactionIdsMatch,
  extractAmount,
  extractTimestamp,
  extractFees,
};
