const mongoose = require('mongoose');

const depositRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paymentMethod: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentMethod', required: true },
    amount: { type: Number, default: null },
    transactionId: { type: String, trim: true },
    message: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    verifiedBy: { type: String, enum: ['manual', 'receiver_sms', 'sms_webhook'], default: null },
    receiverSms: { type: String, default: null },
  },
  { timestamps: true }
);

depositRequestSchema.index({ status: 1, createdAt: -1 });
depositRequestSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);
module.exports = DepositRequest;
