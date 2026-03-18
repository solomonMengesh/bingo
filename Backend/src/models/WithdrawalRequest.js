const mongoose = require('mongoose');

const WITHDRAWAL_MIN_BIRR = 100;

const withdrawalRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: WITHDRAWAL_MIN_BIRR },
    bank: { type: String, required: true, enum: ['CBE', 'Telebirr'] },
    accountNumber: { type: String, required: true, trim: true },
    accountHolderName: { type: String, required: true, trim: true },
    transactionId: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    previousBalance: { type: Number, default: null },
    newBalance: { type: Number, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectReason: { type: String, default: null, trim: true },
    processingTimeMs: { type: Number, default: null },
  },
  { timestamps: true }
);

withdrawalRequestSchema.index({ user: 1, status: 1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });
// transactionId index is already created by { unique: true } on the field

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

module.exports = WithdrawalRequest;
module.exports.WITHDRAWAL_MIN_BIRR = WITHDRAWAL_MIN_BIRR;
