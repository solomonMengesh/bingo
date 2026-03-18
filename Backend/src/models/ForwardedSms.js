const mongoose = require('mongoose');

const forwardedSmsSchema = new mongoose.Schema(
  {
    smsText: { type: String, required: true },
    transactionId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    senderName: { type: String, default: null, trim: true },
    timestamp: { type: Date, default: null },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

forwardedSmsSchema.index({ transactionId: 1, amount: 1 });
forwardedSmsSchema.index({ used: 1 });

const ForwardedSms = mongoose.model('ForwardedSms', forwardedSmsSchema);
module.exports = ForwardedSms;
