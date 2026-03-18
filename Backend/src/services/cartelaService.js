const Cartela = require('../models/Cartela');
const { generateCartelaPool } = require('../utils/cartelaGenerator');
const { hasBingo } = require('../utils/cartelaVerify');

const MIN_POOL = 50;
const MAX_POOL = 200;

/**
 * Generate and persist a pool of unique cartelas for a round.
 * @param {string} gameId - Game _id
 * @param {number} roundNumber - Round number
 * @param {number} poolSize - Number of cartelas (50–200)
 * @returns {Promise<{ created: number, cartelas: Array }>}
 */
async function generateCartelaPoolForRound(gameId, roundNumber, poolSize) {
  const size = Math.min(MAX_POOL, Math.max(MIN_POOL, Number(poolSize) || 100));
  const grids = generateCartelaPool(size);
  const docs = grids.map((numbers) => ({
    gameId,
    roundNumber,
    numbers,
    playerId: null,
    status: 'available',
  }));
  const inserted = await Cartela.insertMany(docs);
  return { created: inserted.length, cartelas: inserted };
}

/**
 * Assign a cartela to a player atomically. Prevents duplicate selection.
 * @param {string} cartelaId - Cartela _id
 * @param {string} playerId - User _id
 * @returns {Promise<{ success: boolean, cartela?: object, message?: string }>}
 */
async function selectCartela(cartelaId, playerId) {
  if (!cartelaId || !playerId) {
    return { success: false, message: 'cartelaId and playerId are required' };
  }
  const updated = await Cartela.findOneAndUpdate(
    { _id: cartelaId, status: 'available' },
    { $set: { status: 'selected', playerId } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    return { success: false, message: 'Cartela not found or already selected' };
  }
  return { success: true, cartela: updated };
}

/**
 * Cancels a previous cartela selection back to "available".
 * Used when stake reservation fails after the cartela was reserved.
 */
async function releaseCartela(cartelaId, playerId) {
  if (!cartelaId) return { success: false };
  const updated = await Cartela.findOneAndUpdate(
    { _id: cartelaId, status: 'selected', ...(playerId ? { playerId } : {}) },
    { $set: { status: 'available', playerId: null } },
    { returnDocument: 'after' }
  );
  return { success: !!updated, cartela: updated };
}

/**
 * Verify if a cartela has a winning pattern against called numbers.
 * @param {string} cartelaId - Cartela _id
 * @param {number[]|Set<number>} calledNumbers - Numbers called so far
 * @returns {Promise<{ valid: boolean, cartela?: object, message?: string }>}
 */
async function verifyBingo(cartelaId, calledNumbers) {
  if (!cartelaId) return { valid: false, message: 'cartelaId is required' };
  const cartela = await Cartela.findById(cartelaId).lean();
  if (!cartela) return { valid: false, message: 'Cartela not found' };
  if (!cartela.numbers || !Array.isArray(calledNumbers)) {
    return { valid: false, message: 'Invalid cartela or calledNumbers' };
  }
  const valid = hasBingo(cartela.numbers, calledNumbers);
  return { valid, cartela: valid ? cartela : undefined, message: valid ? undefined : 'No winning pattern' };
}

/**
 * Get available cartelas for a round (for selection UI).
 */
async function getAvailableCartelas(gameId, roundNumber) {
  return Cartela.find({ gameId, roundNumber, status: 'available' })
    .select('_id numbers')
    .lean();
}

/**
 * Get cartela by id (e.g. for display after selection).
 */
async function getCartelaById(cartelaId) {
  return Cartela.findById(cartelaId).populate('playerId', 'username').lean();
}

module.exports = {
  generateCartelaPoolForRound,
  selectCartela,
  releaseCartela,
  verifyBingo,
  getAvailableCartelas,
  getCartelaById,
  MIN_POOL,
  MAX_POOL,
};
