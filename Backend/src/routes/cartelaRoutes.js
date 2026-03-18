const express = require('express');
const { generateCartela } = require('../utils/cartelaGenerator');
const { generateCartelaPool } = require('../utils/cartelaGenerator');
const cartelaService = require('../services/cartelaService');
const Game = require('../models/Game');

const router = express.Router();

/**
 * POST /api/cartelas/generate
 * Body: none
 * Returns a single random cartela (5×5). For testing / dev.
 */
router.post('/generate', (req, res) => {
  try {
    const numbers = generateCartela();
    return res.status(200).json({ numbers });
  } catch (err) {
    console.error('Error generating cartela', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/cartelas/generate-pool
 * Body: { poolSize?: number } (50–200, default 100)
 * Returns array of unique cartela grids (in-memory only, no DB).
 */
router.post('/generate-pool', (req, res) => {
  try {
    const poolSize = Math.min(200, Math.max(50, Number(req.body?.poolSize) || 100));
    const pool = generateCartelaPool(poolSize);
    return res.status(200).json({ poolSize: pool.length, cartelas: pool });
  } catch (err) {
    console.error('Error generating cartela pool', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/games/:gameId/rounds/:roundNumber/cartelas/generate
 * Body: { poolSize?: number }
 * Creates pool in DB for this round. Idempotent: deletes existing cartelas for this round first.
 */
router.post('/games/:gameId/rounds/:roundNumber/cartelas/generate', async (req, res) => {
  try {
    const { gameId, roundNumber } = req.params;
    const poolSize = req.body?.poolSize ?? 100;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    const Cartela = require('../models/Cartela');
    await Cartela.deleteMany({ gameId, roundNumber });
    const result = await cartelaService.generateCartelaPoolForRound(gameId, roundNumber, poolSize);
    return res.status(201).json(result);
  } catch (err) {
    console.error('Error creating cartela pool for round', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/games/:gameId/rounds/:roundNumber/cartelas
 * Returns available cartelas for selection (id + numbers, or list of ids).
 */
router.get('/games/:gameId/rounds/:roundNumber/cartelas', async (req, res) => {
  try {
    const { gameId, roundNumber } = req.params;
    const cartelas = await cartelaService.getAvailableCartelas(gameId, roundNumber);
    return res.status(200).json({ cartelas });
  } catch (err) {
    console.error('Error listing cartelas', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/cartelas/:cartelaId/select
 * Body: { playerId: string }
 * Atomically assign cartela to player. Returns cartela or error.
 */
router.post('/:cartelaId/select', async (req, res) => {
  try {
    const { cartelaId } = req.params;
    const { playerId } = req.body || {};
    const result = await cartelaService.selectCartela(cartelaId, playerId);
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }
    return res.status(200).json({ cartela: result.cartela });
  } catch (err) {
    console.error('Error selecting cartela', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/cartelas/:cartelaId/verify-bingo
 * Body: { calledNumbers: number[] }
 * Verifies winning pattern. Returns { valid, cartela?, message }.
 */
router.post('/:cartelaId/verify-bingo', async (req, res) => {
  try {
    const { cartelaId } = req.params;
    const { calledNumbers } = req.body || {};
    const result = await cartelaService.verifyBingo(cartelaId, calledNumbers || []);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error verifying bingo', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
