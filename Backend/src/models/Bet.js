const mongoose = require('mongoose');

const betSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true, index: true },
    cardId: { type: mongoose.Schema.Types.Mixed, required: true }, // number (pool index) or ObjectId (legacy Cartela)
    roundNumber: { type: Number, required: true, min: 1 },
    betAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['reserved', 'running', 'won', 'lost', 'cancelled'],
      default: 'running',
      index: true,
    },
    prize: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

betSchema.index({ gameId: 1, roundNumber: 1, status: 1 });
betSchema.index({ userId: 1, createdAt: -1 });

const Bet = mongoose.model('Bet', betSchema);
module.exports = Bet;
