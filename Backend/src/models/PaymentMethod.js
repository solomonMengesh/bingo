const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['mobile_money', 'bank_transfer'],
    },
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    instructions: { type: String, default: '', trim: true },
    minDeposit: { type: Number, required: true, min: 0 },
    maxDeposit: { type: Number, required: true, min: 0 },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

paymentMethodSchema.index({ isEnabled: 1 });

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);
module.exports = PaymentMethod;
