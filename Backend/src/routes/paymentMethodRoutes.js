const express = require('express');
const PaymentMethod = require('../models/PaymentMethod');

const router = express.Router();

// GET /api/payment-methods
// Query: ?enabled=true → only return isEnabled: true (for bot)
router.get('/', async (req, res) => {
  try {
    const enabledOnly = req.query.enabled === 'true';
    const query = enabledOnly ? { isEnabled: true } : {};
    const list = await PaymentMethod.find(query).sort({ createdAt: 1 }).lean();
    return res.json(list);
  } catch (err) {
    console.error('Error listing payment methods', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/payment-methods/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await PaymentMethod.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Payment method not found' });
    return res.json(doc);
  } catch (err) {
    console.error('Error getting payment method', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/payment-methods
router.post('/', async (req, res) => {
  try {
    const {
      name,
      type,
      accountName,
      accountNumber,
      instructions = '',
      minDeposit,
      maxDeposit,
      isEnabled = true,
    } = req.body || {};
    if (!name || !type || !accountName || !accountNumber || minDeposit == null || maxDeposit == null) {
      return res.status(400).json({
        message: 'name, type, accountName, accountNumber, minDeposit, maxDeposit are required',
      });
    }
    if (!['mobile_money', 'bank_transfer'].includes(type)) {
      return res.status(400).json({ message: 'type must be mobile_money or bank_transfer' });
    }
    const doc = await PaymentMethod.create({
      name: String(name).trim(),
      type,
      accountName: String(accountName).trim(),
      accountNumber: String(accountNumber).trim(),
      instructions: String(instructions || '').trim(),
      minDeposit: Number(minDeposit),
      maxDeposit: Number(maxDeposit),
      isEnabled: Boolean(isEnabled),
    });
    return res.status(201).json(doc);
  } catch (err) {
    console.error('Error creating payment method', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/payment-methods/:id
router.patch('/:id', async (req, res) => {
  try {
    const updates = {};
    const allowed = [
      'name',
      'type',
      'accountName',
      'accountNumber',
      'instructions',
      'minDeposit',
      'maxDeposit',
      'isEnabled',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'isEnabled') updates[key] = Boolean(req.body[key]);
        else if (key === 'minDeposit' || key === 'maxDeposit') updates[key] = Number(req.body[key]);
        else updates[key] = String(req.body[key]).trim();
      }
    }
    if (updates.type && !['mobile_money', 'bank_transfer'].includes(updates.type)) {
      return res.status(400).json({ message: 'type must be mobile_money or bank_transfer' });
    }
    const doc = await PaymentMethod.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: 'Payment method not found' });
    return res.json(doc);
  } catch (err) {
    console.error('Error updating payment method', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/payment-methods/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await PaymentMethod.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Payment method not found' });
    return res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    console.error('Error deleting payment method', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
