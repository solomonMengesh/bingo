/**
 * Generate a unique withdrawal transaction ID.
 * Format: WDR-YYYYMMDD-XXXX (e.g. WDR-20260313-A7K2)
 */
function generateWithdrawalTransactionId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WDR-${datePart}-${suffix}`;
}

module.exports = { generateWithdrawalTransactionId };
