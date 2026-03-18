const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    stakeEtb: { type: Number, required: true, min: 1 },
    playerLimit: { type: Number, required: true, min: 1 },
    platformFeePercent: { type: Number, required: true, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['scheduled', 'open', 'running', 'paused', 'stopped', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    /** When the game opens / starts (for scheduled games). Used in bot "Starts in X minutes". */
    scheduledStartAt: { type: Date, default: null },
    isActive: { type: Boolean, default: false },
    playerCount: { type: Number, default: 0, min: 0 },

    // Round loop: cartela_selection → playing → winner → (next round)
    currentRoundNumber: { type: Number, default: 1 },
    roundStatus: {
      type: String,
      enum: ['cartela_selection', 'playing', 'winner'],
      default: 'cartela_selection',
    },
    countdownEndsAt: { type: Date, default: null },
    cartelaSelectionDurationSeconds: { type: Number, default: 40 },
    numberCallIntervalMs: { type: Number, default: 4000 },
    calledNumbers: [{ type: Number }],
    roundWinner: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: String,
      cartelaNumber: Number,
      // Number = pool cartelaId (1..poolSize); ObjectId = legacy Cartela document ref
      cartelaId: { type: mongoose.Schema.Types.Mixed },
      prizeAmount: Number,
    },
    roundWinners: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        cartelaNumber: Number,
        cartelaId: { type: mongoose.Schema.Types.Mixed },
        prizeAmount: Number,
      },
    ],
    winners: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Fixed pool for the whole game (75 or 100 unique 5×5 cartelas), reused every round
    cartelaPool: [
      {
        cartelaId: { type: Number, required: true },
        numbers: { type: [[mongoose.Schema.Types.Mixed]], required: true },
      },
    ],
    // Per-round selections: who selected which cartela in which round (cleared on round reset)
    roundSelections: [
      {
        roundNumber: { type: Number, required: true },
        cartelaId: { type: Number, required: true },
        playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reservedAt: { type: Date, default: Date.now },
      },
    ],

    // Legacy: optional, for backward compatibility
    cartelas: [
      {
        cartelaNumber: { type: Number, required: true },
        selected: { type: Boolean, default: false },
        selectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reservedAt: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true }
);

const Game = mongoose.model('Game', gameSchema);
module.exports = Game;
