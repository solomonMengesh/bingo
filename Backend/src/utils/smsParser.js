/**
 * Parse SMS from CBE and Telebirr to extract amount and transaction ID.
 * Used for deposit requests (customer SMS and receiver SMS).
 *
 * CBE sender: "You have transfered ETB 2.00..." → amount; URL id=FT26074YKC1903699717 → first 12 chars: FT26074YKC19
 * CBE receiver: "Credited with ETB 2.00..." → amount; "Ref No FT26074YKC19" → transaction ID
 * Telebirr sender: "You have transferred ETB 155.00..." → amount; "Your transaction number is DCF8SJR2LG" → transaction ID
 * Telebirr receiver: "You have received ETB 400.00..." → amount; "Your transaction number is DCF3SLFN0V" → transaction ID
 */

const EXTRACT_ERROR_MESSAGE =
  'Could not extract transaction ID and amount from SMS. Please send the full payment confirmation message.';

// Amount: try provider-specific first, then generic
const AMOUNT_PATTERNS = [
  { re: /You have transfered ETB\s*([\d.]+)/i, provider: 'cbe' },       // CBE sender
  { re: /(?:has been )?Credited with ETB\s*([\d.]+)/i, provider: 'cbe' }, // CBE receiver
  { re: /You have transferred ETB\s*([\d.]+)/i, provider: 'telebirr' },  // Telebirr sender
  { re: /You have received ETB\s*([\d.]+)/i, provider: 'telebirr' },    // Telebirr receiver
  { re: /ETB\s*([\d,.]+\d)/i }, // generic fallback
];

// Transaction ID: Telebirr exact; CBE sender = first 12 of URL id; CBE receiver = Ref No
const CBE_ID_URL = /(?:apps\.cbe\.com\.et[^?]*\?id=|id=)([A-Za-z0-9]{12,})/i;
const CBE_REF_NO = /Ref\s+No\s+([A-Za-z0-9]+)/i;
const TELEBIRR_TXN = /Your transaction number is\s*([A-Z0-9]+)/i;

// Sender name: "from X on" or "from X (2519****2255)"
const SENDER_FROM = /from\s+([A-Za-z\s]+?)(?:\s*\([0-9*]+\)|\s+on\s|\.|$)/i;
// Timestamp: DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
const TIMESTAMP_RE = /(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/;

function normalizeAmount(str) {
  if (str == null) return null;
  const n = parseFloat(String(str).replace(/,/g, ''));
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseAmount(text) {
  if (!text || typeof text !== 'string') return null;
  for (const { re } of AMOUNT_PATTERNS) {
    const m = text.match(re);
    if (m && m[1]) {
      const num = normalizeAmount(m[1]);
      if (num != null && num > 0) return num;
    }
  }
  return null;
}

/**
 * Extract transaction ID. For CBE sender (URL id=...) returns first 12 characters so it matches receiver Ref No.
 */
function parseTransactionId(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();

  const telebirrMatch = t.match(TELEBIRR_TXN);
  if (telebirrMatch && telebirrMatch[1]) return telebirrMatch[1].trim();

  const cbeRefMatch = t.match(CBE_REF_NO);
  if (cbeRefMatch && cbeRefMatch[1]) return cbeRefMatch[1].trim();

  const cbeIdMatch = t.match(CBE_ID_URL);
  if (cbeIdMatch && cbeIdMatch[1]) {
    const fullId = cbeIdMatch[1].trim();
    return fullId.length >= 12 ? fullId.slice(0, 12) : fullId;
  }

  return null;
}

/**
 * Detect provider from text (telebirr vs cbe).
 */
function detectProvider(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();
  if (t.includes('telebirr') || t.includes('transaction number is') || t.includes('ethio telecom')) return 'telebirr';
  if (t.includes('cbe') || t.includes('ref no') || t.includes('apps.cbe.com.et') || t.includes('banking with cbe')) return 'cbe';
  return null;
}

/**
 * Extract sender name (e.g. "Andebet Shumet" from "from Andebet Shumet (2519****2255)" or "from Andebet Shumet on").
 */
function parseSenderName(text) {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(SENDER_FROM);
  if (m && m[1]) return m[1].trim();
  return null;
}

/**
 * Parse date/time from SMS (e.g. "15/03/2026 14:16:28" or "15/03/2026").
 */
function parseTimestamp(text) {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(TIMESTAMP_RE);
  if (!m || !m[1]) return null;
  const datePart = m[1];
  const timePart = (m[2] || '00:00').split(':');
  const [d, mo, y] = datePart.split('/').map((n) => parseInt(n, 10));
  if (!y || !mo || !d) return null;
  const date = new Date(y, mo - 1, d);
  const hr = parseInt(timePart[0], 10) || 0;
  const min = parseInt(timePart[1], 10) || 0;
  const sec = parseInt(timePart[2], 10) || 0;
  date.setHours(hr, min, sec, 0);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Normalize transaction ID for matching: CBE uses first 12 chars when comparing sender URL id to receiver Ref No.
 */
function normalizeTransactionIdForMatch(transactionId) {
  if (!transactionId || typeof transactionId !== 'string') return null;
  const t = transactionId.trim();
  return t.length >= 12 ? t.slice(0, 12) : t;
}

/**
 * Parse SMS and return amount, transactionId, provider, senderName, timestamp.
 * Tries amount and transaction ID patterns for CBE and Telebirr.
 */
function parseTransactionSMS(message) {
  if (!message || typeof message !== 'string') return null;
  const text = message.trim();
  if (!text) return null;

  const amount = parseAmount(text);
  const transactionId = parseTransactionId(text);
  const provider = detectProvider(text);
  const senderName = parseSenderName(text);
  const timestamp = parseTimestamp(text);

  if (transactionId == null || amount == null || amount <= 0) return null;
  if (!/^[A-Za-z0-9]{4,32}$/.test(transactionId)) return null;

  return {
    transactionId,
    amount,
    provider: provider || 'unknown',
    senderName: senderName || null,
    timestamp: timestamp || null,
  };
}

/**
 * Legacy: return { amount, transactionId } for compatibility.
 */
function parseSMS(text) {
  const result = parseTransactionSMS(text);
  if (!result) return { amount: null, transactionId: null };
  return { amount: result.amount, transactionId: result.transactionId };
}

module.exports = {
  parseTransactionSMS,
  parseSMS,
  parseAmount,
  parseTransactionId,
  parseSenderName,
  parseTimestamp,
  normalizeTransactionIdForMatch,
  detectProvider,
  EXTRACT_ERROR_MESSAGE,
};
