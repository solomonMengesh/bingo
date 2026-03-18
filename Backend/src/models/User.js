const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
    },
    phone: {
      type: String,
    },
    balance: {
      type: Number,
      default: 0,
    },
    reservedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    role: {
      type: String,
      enum: ['user', 'agent', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'BLOCKED'],
      default: 'ACTIVE',
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;

