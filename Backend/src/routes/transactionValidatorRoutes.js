const express = require('express');
const { validateTransaction } = require('../utils/transactionValidator');

const router = express.Router();

/**
 * POST /api/validate-transaction
 * Body: { senderMessage, receiverMessage }
 * Returns: { valid, transaction, reason } as JSON
 */
router.post('/', (req, res) => {
  try {
    const { senderMessage, receiverMessage } = req.body || {};
    if (!senderMessage || !receiverMessage) {
      return res.status(400).json({
        valid: false,
        transaction: null,
        reason: 'senderMessage and receiverMessage are required.',
      });
    }
    const result = validateTransaction(
      String(senderMessage).trim(),
      String(receiverMessage).trim()
    );
    return res.json(result);
  } catch (err) {
    console.error('Transaction validation error', err);
    return res.status(500).json({
      valid: false,
      transaction: null,
      reason: 'Validation failed due to an internal error.',
    });
  }
});

module.exports = router;
