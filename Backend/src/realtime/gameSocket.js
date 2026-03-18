const mongoose = require('mongoose');
const Game = require('../models/Game');
const User = require('../models/User');
const Bet = require('../models/Bet');
const { buildCartelaBoard, hasBingo } = require('../utils/bingoBoard');
const { hasBingo: hasBingoFromGrid } = require('../utils/cartelaVerify');
const cartelaService = require('../services/cartelaService');

// Round loop: cartela_selection (40s) → playing (call 1–75) → winner (10s) → reset & next round. Stops when admin sets status to 'stopped'.
const CARTELA_SELECTION_SECONDS = 40;
const NUMBER_CALL_INTERVAL_MS = 4000;
const WINNER_DISPLAY_MS = 10000;
const NO_PLAYERS_WAIT_MS = 5000;
const NOT_ENOUGH_PLAYERS_WAIT_MS = 6000;
const CLAIM_WINDOW_MS = 3000;
const MAX_CARTELAS_PER_PLAYER = 4;

const countdownIntervals = new Map();
const numberCallIntervals = new Map();
const winnerTimeouts = new Map();
const claimWindowTimeouts = new Map();
const claimWindowData = new Map();
const numberDecks = new Map();

// Prevent accidental double-submit from the same user (double-click / retries)
// and keep per-user max-selection checks consistent.
const userSelectionLocks = new Set();
async function withUserSelectionLock(lockKey, fn) {
  while (userSelectionLocks.has(lockKey)) {
    // Small delay to avoid blocking the event loop
    await new Promise((r) => setTimeout(r, 10));
  }
  userSelectionLocks.add(lockKey);
  try {
    return await fn();
  } finally {
    userSelectionLocks.delete(lockKey);
  }
}

async function reserveStake(userId, amount) {
  if (!userId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return null;
  const amt = Number(amount);
  return User.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $gte: [{ $subtract: ['$balance', { $ifNull: ['$reservedAmount', 0] }] }, amt] },
    },
    { $inc: { reservedAmount: amt } },
    { returnDocument: 'after' }
  );
}

async function releaseStake(userId, amount) {
  if (!userId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
  const amt = Number(amount);
  const result = await User.updateOne({ _id: userId, reservedAmount: { $gte: amt } }, { $inc: { reservedAmount: -amt } });
  // Safety clamp: if state drifted (should be rare), never allow negative reservedAmount.
  if ((result.matchedCount ?? 0) === 0) {
    await User.updateOne({ _id: userId }, { $set: { reservedAmount: 0 } });
  }
}

async function confirmStake(userId, amount) {
  if (!userId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return null;
  const amt = Number(amount);
  return User.findOneAndUpdate(
    {
      _id: userId,
      balance: { $gte: amt },
      $expr: { $gte: [{ $ifNull: ['$reservedAmount', 0] }, amt] },
    },
    { $inc: { balance: -amt, reservedAmount: -amt } },
    { returnDocument: 'after' }
  );
}

function clearTimersForGame(gameId) {
  const id = String(gameId);
  if (countdownIntervals.has(id)) {
    clearInterval(countdownIntervals.get(id));
    countdownIntervals.delete(id);
  }
  if (numberCallIntervals.has(id)) {
    clearInterval(numberCallIntervals.get(id));
    numberCallIntervals.delete(id);
  }
  if (winnerTimeouts.has(id)) {
    clearTimeout(winnerTimeouts.get(id));
    winnerTimeouts.delete(id);
  }
  if (claimWindowTimeouts.has(id)) {
    clearTimeout(claimWindowTimeouts.get(id));
    claimWindowTimeouts.delete(id);
  }
  claimWindowData.delete(id);
  numberDecks.delete(id);
}

/** Prize for current round:
 * - Prize is only payable when there are at least 2 distinct active players.
 * - Prize amount is based on total cartelas reserved in the round (cartelasCount × stake).
 * - Platform fee is deducted from the total prize pool.
 */
function getRoundPrizeStats(game) {
  const stake = game.stakeEtb || 0;
  const currentRound = game.currentRoundNumber || 1;
  let activePlayersCount = 0;
  let cartelasCount = 0;

  if (game.cartelaPool?.length) {
    const selectionsThisRound = (game.roundSelections || []).filter((s) => s.roundNumber === currentRound);
    cartelasCount = selectionsThisRound.length;
    const ids = selectionsThisRound.map((s) => (s.playerId != null ? String(s.playerId) : null)).filter(Boolean);
    activePlayersCount = new Set(ids).size;
  } else {
    const selectedCartelas = (game.cartelas || []).filter((c) => c.selected && c.selectedBy);
    cartelasCount = selectedCartelas.length;
    const ids = selectedCartelas.map((c) => (c.selectedBy != null ? String(c.selectedBy) : null)).filter(Boolean);
    activePlayersCount = new Set(ids).size;
  }

  const platformFeePercent = game.platformFeePercent ?? 0;
  // Safety rule requested: prizes only if at least 2 active players participate.
  const prizePool = activePlayersCount >= 2 ? cartelasCount * stake : 0;
  const platformFeeAmount = Math.floor((prizePool * platformFeePercent) / 100);
  const winnerPrize = Math.max(0, prizePool - platformFeeAmount);
  return {
    numberOfPlayers: activePlayersCount,
    cartelasCount,
    stake,
    prizePool,
    platformFeeAmount,
    winnerPrize,
  };
}

function emitGameRoundStats(io, gameId, game) {
  const room = `game:${gameId}`;
  const stats = getRoundPrizeStats(game);
  io.to(room).emit('game_round_stats', { gameId, ...stats });
  io.to(room).emit('prizes_updated', { gameId, ...stats });
}

function emitPrizesUpdated(io, gameId, game) {
  const room = `game:${gameId}`;
  const stats = getRoundPrizeStats(game);
  io.to(room).emit('prizes_updated', { gameId, ...stats });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startCountdown(io, game) {
  const gameId = String(game._id);
  clearTimersForGame(gameId);
  const room = `game:${gameId}`;
  const duration = game.cartelaSelectionDurationSeconds ?? CARTELA_SELECTION_SECONDS;
  const endAt = game.countdownEndsAt ? new Date(game.countdownEndsAt) : new Date(Date.now() + duration * 1000);

  const tick = async () => {
    const now = new Date();
    const remaining = Math.max(0, Math.ceil((endAt - now) / 1000));
    io.to(room).emit('countdown_update', { gameId, remainingSeconds: remaining });

    if (remaining <= 0) {
      if (countdownIntervals.has(gameId)) {
        clearInterval(countdownIntervals.get(gameId));
        countdownIntervals.delete(gameId);
      }
      const current = await Game.findById(gameId).lean();
      if (!current || current.status !== 'running' || current.roundStatus !== 'cartela_selection') return;
      const currentRound = current.currentRoundNumber || 1;
      const selectionsThisRound = current.cartelaPool?.length
        ? (current.roundSelections || []).filter((s) => s.roundNumber === currentRound)
        : (current.cartelas || []).filter((c) => c.selected).map((c) => ({ playerId: c.selectedBy }));
      const uniquePlayerIds = new Set(
        selectionsThisRound.map((s) => (s.playerId && s.playerId.toString && s.playerId.toString()) || (s.playerId && String(s.playerId))).filter(Boolean)
      );

      // Skip/refund if there are not enough unique players for a real round.
      // Frontend expects a specific event for this case.
      if (uniquePlayerIds.size < 1) {
        const stake = current.stakeEtb || 0;
        const refundByPlayer = {};
        for (const s of selectionsThisRound) {
          const pid = (s.playerId && s.playerId.toString && s.playerId.toString()) || (s.playerId && String(s.playerId));
          if (pid) {
            refundByPlayer[pid] = (refundByPlayer[pid] || 0) + stake;
          }
        }
        for (const [pid, amount] of Object.entries(refundByPlayer)) {
          if (pid && amount > 0) await releaseStake(pid, amount);
        }
        await Bet.updateMany(
          { gameId: current._id, roundNumber: current.currentRoundNumber || 1, status: { $in: ['reserved', 'running'] } },
          { $set: { status: 'cancelled', prize: 0 } }
        );
        io.to(room).emit('round_skipped_no_players', {
          gameId,
          messageAmharic: 'በዚህ ዙር ምንም ተጫዋች አልተቀላቀለም።\nአዲስ ዙር በቅርቡ ይጀምራል።',
          messageEnglish: 'No players joined this round. A new round will start shortly.',
        });
        winnerTimeouts.set(gameId, setTimeout(() => {
          winnerTimeouts.delete(gameId);
          moveToNextRound(io, gameId);
        }, NO_PLAYERS_WAIT_MS));
        return;
      }

      if (uniquePlayerIds.size < 2) {
        const stake = current.stakeEtb || 0;
        const refundByPlayer = {};
        for (const s of selectionsThisRound) {
          const pid = (s.playerId && s.playerId.toString && s.playerId.toString()) || (s.playerId && String(s.playerId));
          if (pid) refundByPlayer[pid] = (refundByPlayer[pid] || 0) + stake;
        }
        for (const [pid, amount] of Object.entries(refundByPlayer)) {
          if (pid && amount > 0) await releaseStake(pid, amount);
        }
        await Bet.updateMany(
          { gameId: current._id, roundNumber: current.currentRoundNumber || 1, status: { $in: ['reserved', 'running'] } },
          { $set: { status: 'cancelled', prize: 0 } }
        );
        io.to(room).emit('round_skipped_not_enough_players', {
          gameId,
          messageAmharic: 'በዚህ ዙር በቂ ተጫዋቾች አልተቀላቀሉም።\nአዲስ ዙር በቅርቡ ይጀምራል።',
          messageEnglish: 'Not enough players joined this round. A new round will start shortly.',
        });
        winnerTimeouts.set(gameId, setTimeout(() => {
          winnerTimeouts.delete(gameId);
          moveToNextRound(io, gameId);
        }, NOT_ENOUGH_PLAYERS_WAIT_MS));
        return;
      }
      // Confirm reserved stakes (deduct from balance, release reservation) before starting play.
      const stake = current.stakeEtb || 0;
      const confirmByPlayer = {};
      for (const s of selectionsThisRound) {
        const pid = (s.playerId && s.playerId.toString && s.playerId.toString()) || (s.playerId && String(s.playerId));
        if (pid) confirmByPlayer[pid] = (confirmByPlayer[pid] || 0) + stake;
      }
      const failedPlayers = [];
      for (const [pid, amount] of Object.entries(confirmByPlayer)) {
        if (!pid || amount <= 0) continue;
        const ok = await confirmStake(pid, amount);
        if (!ok) {
          // Safety: if stake can't be confirmed, release reservation and cancel their bets.
          await releaseStake(pid, amount);
          failedPlayers.push(pid);
          const uid = mongoose.Types.ObjectId.isValid(pid) ? new mongoose.Types.ObjectId(pid) : pid;
          await Bet.updateMany(
            { gameId: current._id, roundNumber: current.currentRoundNumber || 1, userId: uid, status: 'reserved' },
            { $set: { status: 'cancelled', prize: 0 } }
          );
        }
      }
      if (failedPlayers.length > 0 && current.cartelaPool?.length && current.roundSelections?.length) {
        const failedObjs = failedPlayers.map((pid) =>
          mongoose.Types.ObjectId.isValid(pid) ? new mongoose.Types.ObjectId(pid) : pid
        );
        await Game.updateOne(
          { _id: gameId, status: 'running', roundStatus: 'cartela_selection' },
          { $pull: { roundSelections: { roundNumber: current.currentRoundNumber || 1, playerId: { $in: failedObjs } } } }
        );
      }

      // Move remaining reserved bets into running for this round.
      await Bet.updateMany(
        { gameId: current._id, roundNumber: current.currentRoundNumber || 1, status: 'reserved' },
        { $set: { status: 'running' } }
      );

      const fresh = await Game.findOneAndUpdate(
        { _id: gameId, status: 'running', roundStatus: 'cartela_selection' },
        { $set: { roundStatus: 'playing', calledNumbers: [] } },
        { returnDocument: 'after' }
      );
      if (!fresh) return;
      io.to(room).emit('round_playing', { gameId, roundNumber: fresh.currentRoundNumber });
      startNumberCaller(io, fresh);
    }
  };

  tick();
  const intervalId = setInterval(tick, 1000);
  countdownIntervals.set(gameId, intervalId);
}

function startNumberCaller(io, game) {
  const gameId = String(game._id);
  const room = `game:${gameId}`;
  const deck = shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
  numberDecks.set(gameId, deck);

  const callNext = async () => {
    const fresh = await Game.findById(gameId).lean();
    if (!fresh || fresh.status !== 'running' || fresh.roundStatus !== 'playing') {
      if (numberCallIntervals.has(gameId)) {
        clearInterval(numberCallIntervals.get(gameId));
        numberCallIntervals.delete(gameId);
      }
      return;
    }
    const deckRemaining = numberDecks.get(gameId) || [];
    if (deckRemaining.length === 0) return;
    const value = deckRemaining.shift();
    await Game.findByIdAndUpdate(gameId, { $push: { calledNumbers: value } });
    io.to(room).emit('number_called', { gameId, value });
  };

  const intervalMs = game.numberCallIntervalMs ?? NUMBER_CALL_INTERVAL_MS;
  const intervalId = setInterval(callNext, intervalMs);
  numberCallIntervals.set(gameId, intervalId);
}

async function moveToNextRound(io, gameId) {
  const game = await Game.findById(gameId);
  if (!game || game.status !== 'running') return;
  const currentRound = game.currentRoundNumber || 1;
  const nextRound = currentRound + 1;
  const countdownEndsAt = new Date(Date.now() + (game.cartelaSelectionDurationSeconds ?? CARTELA_SELECTION_SECONDS) * 1000);
  const setFields = {
    currentRoundNumber: nextRound,
    roundStatus: 'cartela_selection',
    calledNumbers: [],
    roundWinner: null,
    roundWinners: [],
    countdownEndsAt,
  };
  const updateOp = { $set: setFields };
  if (game.roundSelections && game.roundSelections.length > 0) {
    updateOp.$pull = { roundSelections: { roundNumber: currentRound } };
  }
  if (game.cartelas && game.cartelas.length > 0) {
    const clearedCartelas = game.cartelas.map((c) => ({
      cartelaNumber: c.cartelaNumber,
      selected: false,
      selectedBy: null,
      reservedAt: null,
    }));
    updateOp.$set.cartelas = clearedCartelas;
  }
  await Game.findByIdAndUpdate(gameId, updateOp);

  const room = `game:${gameId}`;
  io.to(room).emit('round_reset', { gameId });
  io.to(room).emit('round_started', {
    gameId,
    roundNumber: nextRound,
    countdownSeconds: game.cartelaSelectionDurationSeconds ?? CARTELA_SELECTION_SECONDS,
  });
  const fresh = await Game.findById(gameId);
  if (fresh) startCountdown(io, fresh);
}

let sharedIo = null;
function setIo(io) {
  sharedIo = io;
}
function getIo() {
  return sharedIo;
}

async function recoverRunningGames(io) {
  try {
    const games = await Game.find({ status: 'running', roundStatus: 'cartela_selection' }).lean();
    for (const g of games) {
      const game = await Game.findById(g._id);
      if (game) startCountdown(io, game);
    }
  } catch (err) {
    console.error('Error recovering running games', err);
  }
}

function registerGameSocket(io) {
  sharedIo = io;
  recoverRunningGames(io);
  io.on('connection', (socket) => {
    socket.on('join_room', async ({ roomId }) => {
      if (!roomId) return;
      socket.join(`game:${roomId}`);
      const gameId = String(roomId);
      const game = await Game.findById(roomId);
      if (game) {
        if (game.status === 'running' && game.roundStatus === 'cartela_selection' && !countdownIntervals.has(gameId)) {
          startCountdown(io, game);
        }
        emitGameRoundStats(io, gameId, game);
      }
    });

    socket.on('watch_cartelas', async ({ roomId }) => {
      if (!roomId) return;
      socket.join(`game:${roomId}`);
      try {
        const game = await Game.findById(roomId).lean();
        if (!game) return;
        const currentRound = game.currentRoundNumber || 1;
        if (game.cartelaPool && game.cartelaPool.length > 0) {
          const taken = (game.roundSelections || []).filter((s) => s.roundNumber === currentRound).map((s) => s.cartelaId);
          socket.emit('cartela_state', { gameId: roomId, taken, takenByCartelaNumber: false });
        } else {
          const taken = (game.cartelas || []).filter((c) => c.selected).map((c) => c.cartelaNumber);
          socket.emit('cartela_state', { gameId: roomId, taken, takenByCartelaNumber: true });
        }
      } catch (err) {
        console.error('Error in watch_cartelas', err);
      }
    });

    socket.on('select_cartela', async ({ roomId, cartelaId, cartelaNumber, userId, telegramId }) => {
      const gameId = roomId;
      if (!gameId) {
        socket.emit('cartela_select_failed', { roomId, cartelaId, cartelaNumber, reason: 'invalid_payload' });
        return;
      }
      if (!cartelaId && typeof cartelaNumber !== 'number') {
        socket.emit('cartela_select_failed', { roomId: gameId, cartelaId, cartelaNumber, reason: 'invalid_payload' });
        return;
      }
      try {
        let resolvedUserId = userId;
        if (!resolvedUserId && telegramId) {
          const u = await User.findOne({ telegramId: String(telegramId) }).select('_id').lean();
          resolvedUserId = u?._id?.toString();
        }
        if (!resolvedUserId) {
          socket.emit('cartela_select_failed', { roomId: gameId, reason: 'invalid_payload' });
          return;
        }

        const game = await Game.findById(gameId);
        if (!game || game.roundStatus !== 'cartela_selection') {
          socket.emit('cartela_select_failed', { roomId: gameId, cartelaId, cartelaNumber, reason: 'not_selection_phase' });
          return;
        }

        const stake = game.stakeEtb || 0;
        const currentRound = game.currentRoundNumber || 1;
        const playerIdObj = mongoose.Types.ObjectId.isValid(resolvedUserId) ? new mongoose.Types.ObjectId(resolvedUserId) : resolvedUserId;
        const lockKey = `${gameId}:${currentRound}:${resolvedUserId}`;
        const room = `game:${gameId}`;

        // POOL MODE (cartelaPool exists): cartela is reserved in Game.roundSelections with an atomic $nor guard.
        if (game.cartelaPool && game.cartelaPool.length > 0 && (cartelaId != null || typeof cartelaId === 'number')) {
          const numCartelaId = Number(cartelaId);
          if (!Number.isInteger(numCartelaId) || numCartelaId < 1 || numCartelaId > game.cartelaPool.length) {
            socket.emit('cartela_select_failed', { roomId: gameId, cartelaId, reason: 'invalid_cartela' });
            return;
          }

          await withUserSelectionLock(lockKey, async () => {
            const latestGame = await Game.findById(gameId).lean();
            const mySelectionsThisRound = (latestGame?.roundSelections || []).filter(
              (s) => s.roundNumber === currentRound && s.playerId && s.playerId.toString() === resolvedUserId
            );
            if (mySelectionsThisRound.length >= MAX_CARTELAS_PER_PLAYER) {
              socket.emit('cartela_select_failed', {
                roomId: gameId,
                cartelaId: numCartelaId,
                reason: 'max_cartelas_reached',
                message: 'You can select up to 4 cartelas per round.',
              });
              return;
            }
            if (mySelectionsThisRound.some((s) => Number(s.cartelaId) === numCartelaId)) {
              socket.emit('cartela_select_failed', {
                roomId: gameId,
                cartelaId: numCartelaId,
                reason: 'already_selected_by_you',
                message: 'You already selected this cartela.',
              });
              return;
            }

            const reservedAt = new Date();
            const updated = await Game.findOneAndUpdate(
              {
                _id: gameId,
                roundStatus: 'cartela_selection',
                // "isTaken: false" => only push when there is NO existing selection for this cartelaId in this round.
                $nor: [{ roundSelections: { $elemMatch: { roundNumber: currentRound, cartelaId: numCartelaId } } }],
              },
              {
                $push: {
                  roundSelections: {
                    roundNumber: currentRound,
                    cartelaId: numCartelaId,
                    playerId: playerIdObj,
                    reservedAt,
                  },
                },
              },
              { returnDocument: 'after' }
            );

            if (!updated) {
              socket.emit('cartela_select_failed', {
                roomId: gameId,
                cartelaId: numCartelaId,
                reason: 'already_taken',
                message: 'This cartela is already taken.',
              });
              return;
            }

            // Only after cartela reservation succeeds, reserve the stake.
            const reserveOk = stake > 0 ? await reserveStake(resolvedUserId, stake) : { ok: true };
            if (!reserveOk) {
              // Rollback cartela reservation if stake can't be reserved.
              await Game.findOneAndUpdate(
                { _id: gameId, roundStatus: 'cartela_selection' },
                { $pull: { roundSelections: { roundNumber: currentRound, cartelaId: numCartelaId, playerId: playerIdObj } } },
                { returnDocument: 'after' }
              );
              socket.emit('cartela_select_failed', {
                roomId: gameId,
                cartelaId: numCartelaId,
                reason: 'insufficient_balance',
                message: 'Insufficient balance to select a cartela.',
              });
              return;
            }

            await Bet.create({
              userId: playerIdObj,
              gameId,
              cardId: numCartelaId,
              roundNumber: currentRound,
              betAmount: stake,
              status: 'reserved',
              prize: 0,
            });

            io.to(room).emit('cartela_selected', { roomId: gameId, cartelaId: numCartelaId, roundNumber: currentRound, userId: resolvedUserId, reservedAt });
            io.to(room).emit('cartela_reserved', { roomId: gameId, cartelaId: numCartelaId, roundNumber: currentRound, userId: resolvedUserId, reservedAt });
            emitGameRoundStats(io, gameId, updated);
          });
          return;
        }

        // LEGACY MODE (cartelaId refers to Cartela document _id): atomic reserve in Cartela.status first.
        if (cartelaId != null && !game.cartelaPool?.length) {
          await withUserSelectionLock(lockKey, async () => {
            const result = await cartelaService.selectCartela(cartelaId, resolvedUserId);
            if (!result.success) {
              socket.emit('cartela_select_failed', { roomId: gameId, cartelaId, reason: result.message || 'already_taken' });
              return;
            }

            const reserveOk = stake > 0 ? await reserveStake(resolvedUserId, stake) : { ok: true };
            if (!reserveOk) {
              await cartelaService.releaseCartela(cartelaId, resolvedUserId);
              socket.emit('cartela_select_failed', {
                roomId: gameId,
                cartelaId,
                reason: 'insufficient_balance',
                message: 'Insufficient balance to select a cartela.',
              });
              return;
            }

            await Bet.create({
              userId: playerIdObj,
              gameId,
              cardId: cartelaId,
              roundNumber: currentRound,
              betAmount: stake,
              status: 'reserved',
              prize: 0,
            });

            io.to(room).emit('cartela_selected', { roomId: gameId, cartelaId, userId: resolvedUserId });
            io.to(room).emit('cartela_reserved', { roomId: gameId, cartelaId, userId: resolvedUserId });
            const fresh = await Game.findById(gameId);
            if (fresh) emitGameRoundStats(io, gameId, fresh);
          });
          return;
        }

        // LEGACY MODE (cartelaNumber): atomic reserve in Game.cartelas with cartelas.selected:false guard.
        if (typeof cartelaNumber !== 'number') {
          socket.emit('cartela_select_failed', { roomId: gameId, reason: 'invalid_payload' });
          return;
        }

        await withUserSelectionLock(lockKey, async () => {
          const reservedAt = new Date();
          const query = {
            _id: gameId,
            'cartelas.cartelaNumber': cartelaNumber,
            'cartelas.selected': false,
          };
          const update = {
            $set: {
              'cartelas.$.selected': true,
              'cartelas.$.selectedBy': playerIdObj,
              'cartelas.$.reservedAt': reservedAt,
            },
          };

          const updated = await Game.findOneAndUpdate(query, update, { returnDocument: 'after' });
          if (!updated) {
            socket.emit('cartela_select_failed', {
              roomId: gameId,
              cartelaNumber,
              reason: 'already_taken',
              message: 'This cartela is already taken.',
            });
            return;
          }

          const reserveOk = stake > 0 ? await reserveStake(resolvedUserId, stake) : { ok: true };
          if (!reserveOk) {
            // Rollback cartela reservation if stake can't be reserved.
            await Game.findOneAndUpdate(
              {
                _id: gameId,
                'cartelas.cartelaNumber': cartelaNumber,
                'cartelas.selected': true,
                'cartelas.selectedBy': playerIdObj,
              },
              {
                $set: {
                  'cartelas.$.selected': false,
                  'cartelas.$.selectedBy': null,
                  'cartelas.$.reservedAt': null,
                },
              }
            );
            socket.emit('cartela_select_failed', {
              roomId: gameId,
              cartelaNumber,
              reason: 'insufficient_balance',
              message: 'Insufficient balance to select a cartela.',
            });
            return;
          }

          await Bet.create({
            userId: playerIdObj,
            gameId,
            cardId: cartelaNumber,
            roundNumber: currentRound,
            betAmount: stake,
            status: 'reserved',
            prize: 0,
          });

          io.to(room).emit('cartela_selected', { roomId: gameId, cartelaNumber, userId: resolvedUserId, reservedAt });
          io.to(room).emit('cartela_reserved', { roomId: gameId, cartelaNumber, userId: resolvedUserId, reservedAt });
          emitGameRoundStats(io, gameId, updated);
        });
      } catch (err) {
        console.error('Error selecting cartela', err);
        socket.emit('cartela_select_failed', { roomId, cartelaId, cartelaNumber, reason: 'server_error' });
      }
    });

    // Cartela deselection: verify ownership, refund stake, mark available, broadcast to all
    socket.on('deselect_cartela', async ({ roomId, cartelaId, telegramId, userId }) => {
      const gameId = roomId;
      if (!gameId || (cartelaId == null && typeof cartelaId !== 'number')) return;
      try {
        let resolvedUserId = userId;
        if (!resolvedUserId && telegramId) {
          const u = await User.findOne({ telegramId: String(telegramId) }).select('_id').lean();
          resolvedUserId = u?._id?.toString();
        }
        if (!resolvedUserId) {
          socket.emit('cartela_deselect_failed', { roomId: gameId, cartelaId, reason: 'invalid_payload' });
          return;
        }
        const game = await Game.findById(gameId);
        if (!game || game.roundStatus !== 'cartela_selection') {
          socket.emit('cartela_deselect_failed', { roomId: gameId, cartelaId, reason: 'not_selection_phase' });
          return;
        }
        if (!game.cartelaPool || game.cartelaPool.length === 0) {
          socket.emit('cartela_deselect_failed', { roomId: gameId, cartelaId, reason: 'invalid_game' });
          return;
        }
        const numCartelaId = Number(cartelaId);
        const currentRound = game.currentRoundNumber || 1;
        const playerIdStr = resolvedUserId.toString();
        // 1. Verify the cartela belongs to the player
        const hasSelection = (game.roundSelections || []).some(
          (s) => s.roundNumber === currentRound && s.cartelaId === numCartelaId && s.playerId && s.playerId.toString() === playerIdStr
        );
        if (!hasSelection) {
          socket.emit('cartela_deselect_failed', { roomId: gameId, cartelaId: numCartelaId, reason: 'not_your_selection' });
          return;
        }
        const stake = game.stakeEtb || 0;
        const playerIdObj = mongoose.Types.ObjectId.isValid(resolvedUserId) ? new mongoose.Types.ObjectId(resolvedUserId) : resolvedUserId;
        // 2 & 3. Mark cartela as available (remove from roundSelections)
        const updated = await Game.findOneAndUpdate(
          { _id: gameId, roundStatus: 'cartela_selection' },
          { $pull: { roundSelections: { roundNumber: currentRound, cartelaId: numCartelaId, playerId: playerIdObj } } },
          { returnDocument: 'after' }
        );
        if (!updated) {
          socket.emit('cartela_deselect_failed', { roomId: gameId, cartelaId: numCartelaId, reason: 'server_error' });
          return;
        }
        // Release reserved stake for this cartela
        await releaseStake(resolvedUserId, stake);
        await Bet.updateOne(
          { gameId, roundNumber: currentRound, userId: playerIdObj, cardId: numCartelaId, status: 'reserved' },
          { $set: { status: 'cancelled', prize: 0 } }
        );
        const room = `game:${gameId}`;
        // 4. Broadcast deselection to all connected players so others can select it
        io.to(room).emit('cartela_deselected', { gameId, cartelaId: numCartelaId, roundNumber: currentRound, userId: resolvedUserId });
        emitGameRoundStats(io, gameId, updated);
      } catch (err) {
        console.error('Error deselecting cartela', err);
        socket.emit('cartela_deselect_failed', { roomId: gameId, cartelaId, reason: 'server_error' });
      }
    });

    socket.on('bingo_claimed', async ({ gameId, userId, telegramId, username, cartelaNumber, cartelaId }) => {
      if (!gameId) return;
      try {
        let resolvedUserId = userId;
        if (!resolvedUserId && telegramId) {
          const user = await User.findOne({ telegramId: String(telegramId) }).select('_id').lean();
          resolvedUserId = user?._id?.toString();
        }
        if (!resolvedUserId) return;
        const game = await Game.findById(gameId);
        if (!game || game.roundStatus !== 'playing') return;
        const calledNumbers = game.calledNumbers || [];
        let valid = false;
        const numCartelaId = cartelaId != null ? Number(cartelaId) : NaN;
        const usePoolId = !Number.isNaN(numCartelaId) && game.cartelaPool && game.cartelaPool.length > 0;
        if (usePoolId) {
          const poolEntry = game.cartelaPool.find((c) => c.cartelaId === numCartelaId);
          if (poolEntry && poolEntry.numbers) {
            valid = hasBingoFromGrid(poolEntry.numbers, new Set(calledNumbers));
          }
        }
        const winningCartelaId = usePoolId ? numCartelaId : cartelaId;
        if (!valid && cartelaId != null && !usePoolId) {
          const result = await cartelaService.verifyBingo(cartelaId, calledNumbers);
          valid = result.valid;
        }
        if (!valid && cartelaNumber != null) {
          const board = buildCartelaBoard(cartelaNumber);
          valid = hasBingo(board, new Set(calledNumbers));
        }
        if (!valid) {
          socket.emit('bingo_claimed_failed', { gameId, reason: 'invalid_pattern' });
          return;
        }
        const currentRoundNum = game.currentRoundNumber || 1;
        if (usePoolId) {
          const ownsCartela = (game.roundSelections || []).some(
            (s) => s.roundNumber === currentRoundNum && s.cartelaId === numCartelaId && s.playerId && s.playerId.toString() === resolvedUserId
          );
          if (!ownsCartela) {
            socket.emit('bingo_claimed_failed', { gameId, reason: 'not_your_cartela' });
            return;
          }
        }

        const id = String(gameId);
        // Active players = unique users who reserved at least 1 cartela this round.
        const activePlayersCount = (() => {
          if (game.cartelaPool?.length) {
            const selections = (game.roundSelections || []).filter((s) => s.roundNumber === currentRoundNum);
            const ids = selections.map((s) => (s.playerId != null ? String(s.playerId) : null)).filter(Boolean);
            return new Set(ids).size;
          }
          const selectedCartelas = (game.cartelas || []).filter((c) => c.selected);
          const ids = selectedCartelas.map((c) => (c.selectedBy != null ? String(c.selectedBy) : null)).filter(Boolean);
          return new Set(ids).size;
        })();

        // Prize amount must be based on cartelasCount × stake (but only payable when >=2 active players).
        const cartelasCount = (() => {
          if (game.cartelaPool?.length) {
            const selections = (game.roundSelections || []).filter((s) => s.roundNumber === currentRoundNum);
            return selections.length;
          }
          const selectedCartelas = (game.cartelas || []).filter((c) => c.selected && c.selectedBy);
          return selectedCartelas.length;
        })();

        const totalPot = activePlayersCount >= 2 ? game.stakeEtb * cartelasCount : 0;
        const feeFraction = 1 - (game.platformFeePercent || 0) / 100;
        const winnerPrizeTotal = Math.floor(totalPot * feeFraction);

        const winnerUser = await User.findById(resolvedUserId).select('username').lean();
        const winnerEntry = {
          userId: resolvedUserId,
          username: winnerUser?.username || username || 'Winner',
          cartelaNumber: cartelaNumber ?? winningCartelaId,
          cartelaId: winningCartelaId || undefined,
        };

        if (claimWindowData.has(id)) {
          const data = claimWindowData.get(id);
          if (!data.winners.some((w) => w.userId === resolvedUserId)) {
            data.winners.push(winnerEntry);
          }
          return;
        }

        claimWindowData.set(id, {
          winners: [winnerEntry],
          winnerPrizeTotal,
        });
        const timeoutId = setTimeout(async () => {
          claimWindowTimeouts.delete(id);
          const data = claimWindowData.get(id);
          claimWindowData.delete(id);
          if (!data || data.winners.length === 0) return;
          const winners = data.winners;
          const splitPrize = Math.floor(data.winnerPrizeTotal / winners.length);

          for (const w of winners) {
            await User.findByIdAndUpdate(w.userId, { $inc: { balance: splitPrize } });
          }

          const gameDoc = await Game.findById(gameId);
          if (!gameDoc || gameDoc.roundStatus !== 'playing') return;
          const currentRound = gameDoc.currentRoundNumber || 1;
          for (const w of winners) {
            const uid = mongoose.Types.ObjectId.isValid(w.userId) ? w.userId : new mongoose.Types.ObjectId(w.userId);
            await Bet.updateMany(
              { gameId, roundNumber: currentRound, userId: uid, cardId: w.cartelaId, status: 'running' },
              { $set: { status: 'won', prize: splitPrize } }
            );
          }
          await Bet.updateMany(
            { gameId, roundNumber: currentRound, status: 'running' },
            { $set: { status: 'lost', prize: 0 } }
          );
          const first = winners[0];
          gameDoc.roundStatus = 'winner';
          gameDoc.roundWinner = {
            userId: mongoose.Types.ObjectId.isValid(first.userId) ? new mongoose.Types.ObjectId(first.userId) : first.userId,
            username: first.username,
            cartelaNumber: first.cartelaNumber,
            cartelaId: first.cartelaId,
            prizeAmount: splitPrize,
          };
          gameDoc.roundWinners = winners.map((w) => ({
            userId: mongoose.Types.ObjectId.isValid(w.userId) ? new mongoose.Types.ObjectId(w.userId) : w.userId,
            username: w.username,
            cartelaNumber: w.cartelaNumber,
            cartelaId: w.cartelaId,
            prizeAmount: splitPrize,
          }));
          await gameDoc.save();

          if (numberCallIntervals.has(id)) {
            clearInterval(numberCallIntervals.get(id));
            numberCallIntervals.delete(id);
          }

          const winnerIds = winners.map((w) => w.userId).filter(Boolean);
          const winnerUsers = await User.find({ _id: { $in: winnerIds } }).select('username phone').lean();
          const userById = new Map(winnerUsers.map((u) => [u._id.toString(), u]));

          let winningBoard = null;
          if (gameDoc.cartelaPool?.length && first.cartelaId != null) {
            const entry = gameDoc.cartelaPool.find((c) => c.cartelaId === first.cartelaId || c.cartelaId === Number(first.cartelaId));
            if (entry?.numbers) {
              winningBoard = entry.numbers.map((row) =>
                row.map((val) => (val == null ? { value: null, isFree: true } : { value: val, isFree: false }))
              );
            }
          }

          const room = `game:${gameId}`;
          io.to(room).emit('round_winner', {
            gameId,
            winners: winners.map((w) => {
              const u = userById.get(String(w.userId));
              return {
                userId: w.userId,
                username: u?.username || w.username,
                phone: u?.phone || null,
                cartelaNumber: w.cartelaNumber,
                cartelaId: w.cartelaId,
                prizeAmount: splitPrize,
              };
            }),
            winningBoard,
          });

          winnerTimeouts.set(id, setTimeout(() => {
            winnerTimeouts.delete(id);
            moveToNextRound(io, gameId);
          }, WINNER_DISPLAY_MS));
        }, CLAIM_WINDOW_MS);
        claimWindowTimeouts.set(id, timeoutId);
      } catch (err) {
        console.error('Error processing bingo claim', err);
        socket.emit('bingo_claimed_failed', { gameId, reason: 'server_error' });
      }
    });

    socket.on('start_game', async ({ gameId }) => {
      if (!gameId) return;
      try {
        const game = await Game.findById(gameId);
        if (!game || game.status !== 'scheduled') return;
        game.status = 'running';
        game.currentRoundNumber = 1;
        game.roundStatus = 'cartela_selection';
        const now = new Date();
        game.countdownEndsAt = new Date(now.getTime() + (game.cartelaSelectionDurationSeconds ?? CARTELA_SELECTION_SECONDS) * 1000);
        game.calledNumbers = [];
        game.roundWinner = undefined;
        if (game.roundSelections && game.roundSelections.length) game.roundSelections = [];
        if (game.cartelas && game.cartelas.length) {
          game.cartelas.forEach((c) => {
            c.selected = false;
            c.selectedBy = null;
          });
        }
        await game.save();
        io.to(`game:${gameId}`).emit('round_started', {
          gameId,
          roundNumber: 1,
          countdownSeconds: game.cartelaSelectionDurationSeconds ?? CARTELA_SELECTION_SECONDS,
        });
        startCountdown(io, game);
      } catch (err) {
        console.error('Error starting game', err);
      }
    });

    socket.on('disconnect', () => {});
  });
}

module.exports = {
  registerGameSocket,
  clearTimersForGame,
  startCountdown,
  setIo,
  getIo,
};
