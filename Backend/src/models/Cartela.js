const mongoose = require('mongoose');

/**
 * Bingo cartela (ticket): 5×5 grid stored per round.
 * numbers[row][col]: 1-75 by column rules, null = FREE at center (2,2).
 */
const cartelaSchema = new mongoose.Schema(
  {
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    roundNumber: { type: Number, required: true },
    numbers: {
      type: [[mongoose.Schema.Types.Mixed]],
      required: true,
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length === 5 && v.every((row) => Array.isArray(row) && row.length === 5);
        },
        message: 'numbers must be a 5×5 grid',
      },
    },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['available', 'selected'],
      default: 'available',
    },
  },
  { timestamps: true }
);

cartelaSchema.index({ gameId: 1, roundNumber: 1 });
cartelaSchema.index({ gameId: 1, roundNumber: 1, status: 1 });

const Cartela = mongoose.model('Cartela', cartelaSchema);
module.exports = Cartela;
