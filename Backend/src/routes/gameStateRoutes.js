const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');

const router = express.Router();

// GET /api/game/state?telegramId=xxx&gameId=yyy — game state for player. If gameId given, return that game's state (must be running); else return one active/running game.
router.get('/state', async (req, res) => {
  try {
    const { telegramId, gameId } = req.query;
    let game;
    if (gameId) {
      game = await Game.findOne({ _id: gameId, status: 'running' }).lean();
    }
    if (!game) {
      game = await Game.findOne({
        $or: [{ isActive: true }, { status: 'running' }],
      })
        .sort({ updatedAt: -1 })
        .lean();
    }
    if (!game || (game.status !== 'scheduled' && game.status !== 'running')) {
      return res.status(200).json({ game: null, state: null });
    }

    let userId = null;
    if (telegramId) {
      const user = await User.findOne({ telegramId: String(telegramId) }).select('_id').lean();
      userId = user?._id?.toString();
    }

    const currentRound = game.currentRoundNumber || 1;
    const roundSelections = game.roundSelections || [];
    const selectionsThisRound = roundSelections.filter((s) => s.roundNumber === currentRound);

    let myCartelaNumber = null;
    let myCartelaId = null;
    let myCartelaIds = [];
    if (userId && game.cartelaPool && game.cartelaPool.length > 0) {
      const mySels = selectionsThisRound.filter((s) => s.playerId && s.playerId.toString() === userId);
      myCartelaIds = mySels.map((s) => s.cartelaId).filter((id) => id != null);
      if (myCartelaIds.length) myCartelaId = myCartelaIds[0];
    }
    if (userId && game.cartelas && myCartelaIds.length === 0) {
      const myCartela = game.cartelas.find((c) => c.selectedBy && c.selectedBy.toString() === userId);
      if (myCartela) myCartelaNumber = myCartela.cartelaNumber;
    }

    const now = new Date();
    let countdownRemaining = 0;
    if (game.roundStatus === 'cartela_selection' && game.countdownEndsAt) {
      const remaining = Math.ceil((new Date(game.countdownEndsAt) - now) / 1000);
      countdownRemaining = Math.max(0, remaining);
    }

    // Active players = unique users who reserved at least 1 cartela this round.
    const numberOfPlayers = (() => {
      if (game.cartelaPool?.length) {
        const ids = selectionsThisRound.map((s) => (s.playerId != null ? String(s.playerId) : null)).filter(Boolean);
        return new Set(ids).size;
      }
      const selectedCartelas = (game.cartelas || []).filter((c) => c.selected && c.selectedBy);
      const ids = selectedCartelas.map((c) => (c.selectedBy != null ? String(c.selectedBy) : null)).filter(Boolean);
      return new Set(ids).size;
    })();
    const stakeEtb = game.stakeEtb || 0;

    // Prize amount is based on total cartelas reserved in the round.
    const cartelasCount = (() => {
      if (game.cartelaPool?.length) return selectionsThisRound.length;
      return (game.cartelas || []).filter((c) => c.selected && c.selectedBy).length;
    })();

    const prizePool = numberOfPlayers >= 2 ? cartelasCount * stakeEtb : 0;
    const platformFeePercent = game.platformFeePercent ?? 0;
    const platformFeeAmount = Math.floor((prizePool * platformFeePercent) / 100);
    const winnerPrize = Math.max(0, prizePool - platformFeeAmount);

    let roundWinner = game.roundWinner || null;
    let roundWinners = game.roundWinners || [];
    let winnerBoard = null;

    if (roundWinner) {
      const winnerUserId = roundWinner.userId?.toString?.() || roundWinner.userId;
      if (winnerUserId) {
        const winnerUser = await User.findById(winnerUserId).select('username phone').lean();
        if (winnerUser) {
          roundWinner = {
            ...roundWinner,
            username: winnerUser.username ?? roundWinner.username,
            phone: winnerUser.phone ?? null,
          };
        }
      }
      const cid = roundWinner.cartelaId != null ? roundWinner.cartelaId : null;
      if (cid != null && game.cartelaPool?.length) {
        const entry = game.cartelaPool.find((c) => c.cartelaId === cid || c.cartelaId === Number(cid));
        if (entry?.numbers) {
          winnerBoard = entry.numbers.map((row) =>
            row.map((val) => (val == null ? { value: null, isFree: true } : { value: val, isFree: false }))
          );
        }
      }
    }

    if (roundWinners.length > 0) {
      const winnerIds = roundWinners.map((w) => w.userId?.toString?.() || w.userId).filter(Boolean);
      const winnerUsers = await User.find({ _id: { $in: winnerIds } }).select('username phone').lean();
      const userMap = new Map(winnerUsers.map((u) => [u._id.toString(), u]));
      roundWinners = roundWinners.map((w) => {
        const u = userMap.get(String(w.userId));
        return { ...w, username: u?.username ?? w.username, phone: u?.phone ?? w.phone };
      });
    } else if (roundWinner) {
      roundWinners = [roundWinner];
    }

    const state = {
      gameId: game._id.toString(),
      status: game.status,
      roundStatus: game.roundStatus,
      currentRoundNumber: currentRound,
      countdownRemaining,
      calledNumbers: game.calledNumbers || [],
      roundWinner,
      roundWinners,
      winnerBoard,
      myCartelaNumber,
      myCartelaId,
      myCartelaIds,
      stakeEtb,
      playerLimit: game.playerLimit,
      cartelaPool: game.cartelaPool || [],
      selectedForRound: selectionsThisRound.map((s) => ({ cartelaId: s.cartelaId, playerId: s.playerId?.toString(), reservedAt: s.reservedAt ?? null })),
      numberOfPlayers,
      prizePool,
      winnerPrize,
      platformFeePercent,
    };

    return res.status(200).json({ game: state, state });
  } catch (err) {
    console.error('Error in GET /api/game/state', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
