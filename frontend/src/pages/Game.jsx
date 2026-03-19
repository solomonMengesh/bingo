import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CallerStats from '../components/CallerStats';
import CallerBoard from '../components/CallerBoard';
import BingoBoard from '../components/BingoBoard';
import socket from '../services/socket';
import soundManager from '../services/soundManager';
import { useAuth } from '../context/AuthContext';
import { useGameState } from '../hooks/useGameState';

const columnRanges = [
  { from: 1, to: 15 },
  { from: 16, to: 30 },
  { from: 31, to: 45 },
  { from: 46, to: 60 },
  { from: 61, to: 75 },
];

const buildLabel = (n) => {
  if (n >= 1 && n <= 15) return `B${n}`;
  if (n >= 16 && n <= 30) return `I${n}`;
  if (n >= 31 && n <= 45) return `N${n}`;
  if (n >= 46 && n <= 60) return `G${n}`;
  return `O${n}`;
};

const getCalledBallClass = (label) => {
  const letter = (label && label[0]) || '';
  switch (letter) {
    case 'B': return 'bg-red-500 text-white';
    case 'I': return 'bg-yellow-400 text-slate-900';
    case 'N': return 'bg-sky-500 text-white';
    case 'G': return 'bg-emerald-500 text-white';
    case 'O': return 'bg-purple-500 text-white';
    default: return 'bg-slate-500 text-white';
  }
};

const buildCartelaBoard = (cartelaNumber) => {
  const seed = Math.max(1, Number(cartelaNumber) || 1);
  const shiftBase = (seed - 1) % 15;
  const rows = [];
  for (let r = 0; r < 5; r += 1) {
    const row = [];
    for (let c = 0; c < 5; c += 1) {
      const isFree = r === 2 && c === 2;
      if (isFree) {
        row.push({ value: null, isFree: true });
        continue;
      }
      const range = columnRanges[c];
      const span = range.to - range.from + 1;
      const idx = (shiftBase + r + c * 3) % span;
      const value = range.from + idx;
      row.push({ value, isFree: false });
    }
    rows.push(row);
  }
  return rows;
};

const buildMarkedFromCalled = (board, calledNumbers) => {
  const calledSet = new Set(calledNumbers || []);
  const marked = new Set();
  if (!board || !Array.isArray(board)) return marked;
  board.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
      if (cell?.isFree) marked.add(`${rIdx}-${cIdx}`);
      else if (typeof cell?.value === 'number' && calledSet.has(cell.value)) marked.add(`${rIdx}-${cIdx}`);
    });
  });
  return marked;
};

/**
 * Bingo validation (must match backend): horizontal row, vertical column, main diagonal, anti-diagonal.
 * Board: 5×5, cell = { value, isFree }. Center (2,2) is FREE and counts as hit.
 */
function hasWinningPattern(board, calledNumbers) {
  if (!board || !Array.isArray(board) || board.length !== 5) return false;
  const calledSet = calledNumbers instanceof Set ? calledNumbers : new Set(calledNumbers || []);
  const isHit = (r, c) => {
    const cell = board[r]?.[c];
    if (cell?.isFree) return true;
    return typeof cell?.value === 'number' && calledSet.has(cell.value);
  };
  // 1. Horizontal: any complete row
  for (let r = 0; r < 5; r++) {
    let rowComplete = true;
    for (let c = 0; c < 5; c++) if (!isHit(r, c)) { rowComplete = false; break; }
    if (rowComplete) return true;
  }
  // 2. Vertical: any complete column
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    for (let r = 0; r < 5; r++) if (!isHit(r, c)) { colComplete = false; break; }
    if (colComplete) return true;
  }
  // 3. Main diagonal: (0,0) → (4,4)
  let mainComplete = true;
  for (let i = 0; i < 5; i++) if (!isHit(i, i)) { mainComplete = false; break; }
  if (mainComplete) return true;
  // 4. Anti-diagonal: (0,4) → (4,0)
  let antiComplete = true;
  for (let i = 0; i < 5; i++) if (!isHit(i, 4 - i)) { antiComplete = false; break; }
  return antiComplete;
}

const Game = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const telegramId = user?.id ?? null;
  const { roomId: locRoomId, entryFee: locEntryFee, cartelaNumber: locCartela, cartelaId: locCartelaId, cartelaIds: locCartelaIds } = location.state || {};
  const { state, refetch } = useGameState(telegramId, locRoomId || undefined);
  const roomId = locRoomId || state?.gameId;
  const entryFee = locEntryFee ?? state?.stakeEtb;
  const cartelaNumber = locCartela ?? state?.myCartelaNumber;
  const cartelaId = locCartelaId ?? state?.myCartelaId;
  const cartelaIds = Array.isArray(locCartelaIds) && locCartelaIds.length > 0
    ? locCartelaIds
    : (state?.myCartelaIds?.length ? state.myCartelaIds : (cartelaId != null ? [cartelaId] : []));
  const usePool = Array.isArray(state?.cartelaPool) && state.cartelaPool.length > 0;
  const hasCartelaThisRound = usePool ? cartelaIds.length > 0 : (cartelaNumber != null);

  const [calledNumbers, setCalledNumbers] = useState(() => new Set(state?.calledNumbers || []));
  const [currentNumber, setCurrentNumber] = useState(null);
  const [winner, setWinner] = useState(null);
  const [gameFinished, setGameFinished] = useState(false);
  const [bingoError, setBingoError] = useState(null);
  // Auto-bingo is always enabled (no manual AUTO/BINGO controls).
  const autoBingo = true;
  const [soundOn, setSoundOn] = useState(() => {
    try {
      const stored = localStorage.getItem('bingo_sound_on');
      return stored !== 'false';
    } catch {
      return true;
    }
  });
  const soundUnlockRef = useRef(false);
  const [roundStats, setRoundStats] = useState(() => ({
    numberOfPlayers: state?.numberOfPlayers ?? 0,
    stake: state?.stakeEtb ?? entryFee ?? 0,
    prizePool: state?.prizePool ?? 0,
    winnerPrize: state?.winnerPrize ?? 0,
  }));
  const hasClaimedRef = useRef(false);
  const calledNumbersRef = useRef(calledNumbers);

  const cartelaBoards = useMemo(() => {
    const list = [];
    for (const cid of cartelaIds) {
      if (usePool && state?.cartelaPool) {
        const entry = state.cartelaPool.find((c) => c.cartelaId === cid);
        if (entry?.numbers) {
          const board = entry.numbers.map((row) =>
            row.map((val) => (val == null ? { value: null, isFree: true } : { value: val, isFree: false }))
          );
          list.push({ cartelaId: cid, board });
        }
      } else {
        list.push({ cartelaId: cid, board: buildCartelaBoard(cid) });
      }
    }
    if (list.length === 0 && (cartelaId != null || cartelaNumber != null)) {
      const singleId = cartelaId ?? cartelaNumber;
      if (usePool && state?.cartelaPool) {
        const entry = state.cartelaPool.find((c) => c.cartelaId === singleId);
        if (entry?.numbers) {
          const board = entry.numbers.map((row) =>
            row.map((val) => (val == null ? { value: null, isFree: true } : { value: val, isFree: false }))
          );
          list.push({ cartelaId: singleId, board });
        }
      } else {
        list.push({ cartelaId: singleId, board: buildCartelaBoard(singleId) });
      }
    }
    return list;
  }, [usePool, cartelaIds, cartelaId, cartelaNumber, state?.cartelaPool]);

  const calledArray = Array.from(calledNumbers);
  calledNumbersRef.current = calledNumbers;

  useEffect(() => {
    soundManager.setEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => {
    if (!roomId) return;
    if (!socket.connected) socket.connect();
    socket.emit('join_room', { roomId });
  }, [roomId]);

  useEffect(() => {
    setRoundStats((prev) => ({
      ...prev,
      numberOfPlayers: state?.numberOfPlayers ?? prev.numberOfPlayers,
      stake: entryFee ?? prev.stake,
      prizePool: state?.prizePool ?? prev.prizePool,
      winnerPrize: state?.winnerPrize ?? prev.winnerPrize,
    }));
  }, [state?.numberOfPlayers, state?.prizePool, state?.winnerPrize, entryFee]);

  useEffect(() => {
    if (!roomId) return undefined;
    const initial = state?.calledNumbers || [];
    if (initial.length) setCalledNumbers((prev) => new Set([...prev, ...initial]));
  }, [roomId, state?.calledNumbers]);

  useEffect(() => {
    if (!hasCartelaThisRound || gameFinished || hasClaimedRef.current || cartelaBoards.length === 0) return;
    for (const { cartelaId: cid, board } of cartelaBoards) {
      if (hasWinningPattern(board, calledArray)) {
        hasClaimedRef.current = true;
        setGameFinished(true);
        setBingoError(null);
        socket.emit('bingo_claimed', {
          gameId: roomId,
          telegramId,
          username: user?.first_name,
          cartelaNumber: usePool ? undefined : cid,
          cartelaId: usePool ? (cid != null ? Number(cid) : undefined) : undefined,
        });
        break;
      }
    }
  }, [calledArray, cartelaBoards, hasCartelaThisRound, gameFinished, roomId, telegramId, user?.first_name, usePool]);

  useEffect(() => {
    if (!roomId) return undefined;
    const onNumber = (payload) => {
      const value = payload?.value ?? payload?.number;
      if (payload?.gameId !== roomId || typeof value !== 'number') return;
      setCalledNumbers((prev) => new Set([...prev, value]));
      setCurrentNumber({ label: buildLabel(value), value });
      if (soundOn) soundManager.playNumber(value);
    };
    const onRoundWinner = (payload) => {
      if (payload?.gameId !== roomId) return;
      setGameFinished(true);
      if (soundOn) soundManager.playBingo();
      const winners = Array.isArray(payload.winners) ? payload.winners : (payload.winner ? [payload.winner] : []);
      const first = winners[0];
      setWinner(winners.length > 1 ? `${winners.length} winners (tied)` : (first?.username || 'A player'));
      const latestCalled = calledNumbersRef.current;
      const localWinningBoard = first?.cartelaId != null
        ? cartelaBoards.find((c) => c.cartelaId == first.cartelaId)?.board
        : null;
      const boardToShow = payload.winningBoard ?? localWinningBoard ?? cartelaBoards[0]?.board;
      navigate('/win', {
        state: {
          roomId,
          entryFee,
          prizePool: first?.prizeAmount ?? roundStats.winnerPrize,
          cartelaNumber: first?.cartelaNumber ?? first?.cartelaId ?? cartelaNumber,
          board: boardToShow,
          calledNumbers: Array.from(latestCalled),
          roundWinner: first,
          winners: winners.length ? winners : undefined,
        },
        replace: true,
      });
    };
    const onBingoFailed = (payload) => {
      if (payload?.gameId !== roomId) return;
      hasClaimedRef.current = false;
      setGameFinished(false);
      setBingoError(payload?.reason === 'invalid_pattern' ? 'Complete a row, column, or diagonal first.' : 'Claim failed. Try again.');
    };
    const onRoundStats = (payload) => {
      if (payload?.gameId !== roomId) return;
      setRoundStats((prev) => ({
        ...prev,
        numberOfPlayers: payload.numberOfPlayers ?? prev.numberOfPlayers,
        stake: payload.stake ?? prev.stake,
        prizePool: payload.prizePool ?? prev.prizePool,
        winnerPrize: payload.winnerPrize ?? prev.winnerPrize,
      }));
    };
    const onPrizesUpdated = (payload) => {
      if (payload?.gameId !== roomId) return;
      setRoundStats((prev) => ({
        ...prev,
        numberOfPlayers: payload.numberOfPlayers ?? prev.numberOfPlayers,
        stake: payload.stake ?? prev.stake,
        prizePool: payload.prizePool ?? prev.prizePool,
        winnerPrize: payload.winnerPrize ?? prev.winnerPrize,
      }));
    };
    const onRoundSkippedNoPlayers = (payload) => {
      if (payload?.gameId !== roomId) return;
      navigate('/win', {
        state: {
          roomId,
          entryFee,
          noPlayers: true,
          messageAmharic: payload.messageAmharic || 'በዚህ ዙር ምንም ተጫዋች አልተቀላቀለም። አዲስ ዙር በቅርቡ ይጀምራል።',
          messageEnglish: payload.messageEnglish || 'No players joined this round. A new round will start shortly.',
        },
        replace: true,
      });
    };
    socket.on('number_called', onNumber);
    socket.on('round_winner', onRoundWinner);
    socket.on('bingo_claimed_failed', onBingoFailed);
    socket.on('game_round_stats', onRoundStats);
    socket.on('prizes_updated', onPrizesUpdated);
    socket.on('round_skipped_no_players', onRoundSkippedNoPlayers);
    return () => {
      socket.off('number_called', onNumber);
      socket.off('round_winner', onRoundWinner);
      socket.off('bingo_claimed_failed', onBingoFailed);
      socket.off('game_round_stats', onRoundStats);
      socket.off('prizes_updated', onPrizesUpdated);
      socket.off('round_skipped_no_players', onRoundSkippedNoPlayers);
    };
  }, [roomId, navigate, entryFee, cartelaNumber, cartelaBoards, roundStats.winnerPrize, soundOn]);

  if (state?.roundStatus === 'cartela_selection') {
    navigate('/cartela', { state: { roomId, entryFee }, replace: true });
    return null;
  }
  if (state?.roundStatus === 'winner') {
    const noWinner = !state.roundWinner;
    navigate('/win', {
      state: noWinner
        ? {
            roomId,
            entryFee,
            noPlayers: true,
            messageAmharic: 'በዚህ ዙር ምንም ተጫዋች አልተቀላቀለም። አዲስ ዙር በቅርቡ ይጀምራል።',
            messageEnglish: 'No players joined this round. A new round will start shortly.',
          }
        : {
            roomId,
            entryFee,
            roundWinner: state.roundWinner,
            winners: state.roundWinners && state.roundWinners.length > 0 ? state.roundWinners : (state.roundWinner ? [state.roundWinner] : undefined),
            winnerBoard: state.winnerBoard,
            calledNumbers: state.calledNumbers,
          },
      replace: true,
    });
    return null;
  }

  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        No game. Return to lobby.
      </div>
    );
  }

  const handleSoundUnlock = () => {
    if (!soundUnlockRef.current) {
      soundUnlockRef.current = true;
      soundManager.unlock();
      soundManager.preloadNumberSounds();
    }
  };

  const handleToggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bingo_sound_on', String(next));
      } catch (_) {}
      soundManager.setEnabled(next);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col" onClick={handleSoundUnlock} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSoundUnlock(); }} role="application" tabIndex={0}>
      <div className="flex items-center justify-end gap-2 mb-1">
        <button
          type="button"
          onClick={() => refetch()}
          className="shrink-0 rounded-xl bg-slate-700/90 hover:bg-slate-600 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 flex items-center gap-1.5"
        >
          <span aria-hidden>🔄</span> Refresh
        </button>
      </div>
      <CallerStats
        winnerPrize={roundStats.winnerPrize}
        derash={roundStats.prizePool}
        players={roundStats.numberOfPlayers}
        stake={roundStats.stake || 0}
        call={`${calledNumbers.size}/75`}
        soundOn={soundOn}
        onToggleSound={handleToggleSound}
      />
      <div className="flex flex-row gap-3 mt-1 pb-2">
        <div className="basis-[40%] max-w-[260px]">
          <CallerBoard calledSet={calledNumbers} currentNumber={currentNumber} />
        </div>
        <div className="basis-[60%] flex flex-col gap-3 items-center">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 py-1">
            {(() => {
              const lastFour = calledArray.slice(-4);
              if (lastFour.length === 0) return null;
              return lastFour.map((value, i) => {
                const label = buildLabel(value);
                const isCurrent = i === lastFour.length - 1;
                const ballClass = getCalledBallClass(label);
                return (
                  <div
                    key={`${value}-${i}`}
                    className={`rounded-full flex items-center justify-center font-bold text-white shrink-0
                      ${isCurrent ? 'h-12 w-12 text-base' : 'h-8 w-8 text-[10px]'}
                      ${ballClass}
                      ${isCurrent ? 'animate-current-ball-attract' : ''}`}
                  >
                    {label}
                  </div>
                );
              });
            })()}
          </div>
          <div className="flex flex-col items-center gap-1 w-full">
            {hasCartelaThisRound ? (
              <div className="w-full">
                <div
                  className={`grid gap-2 sm:gap-3 justify-items-center ${
                    cartelaBoards.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-2'
                  }`}
                >
                  {cartelaBoards.map(({ cartelaId: cid, board }) => (
                    <div key={cid} className="flex flex-col items-center">
                      <BingoBoard
                        board={board}
                        marked={buildMarkedFromCalled(board, calledArray)}
                        currentNumber={currentNumber}
                        onCellClick={undefined}
                        compact={cartelaBoards.length > 1}
                      />
                      <div className={`text-slate-400 mt-0.5 ${cartelaBoards.length > 1 ? 'text-[8px]' : 'text-[10px]'}`}>Cartela #{cid}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="inline-block rounded-3xl bg-[#020817] border border-slate-800 shadow-bingo-card px-4 py-6 text-center min-h-[200px] flex flex-col justify-center">
                <p className="text-slate-200 text-lg leading-relaxed">
                  የዚህ ዙር ጨዋታ ተጀምሯል። አድስ ዙር አስኪጀመር እዚሁ ይጠብቁ።
                </p>
                <p className="text-slate-400 text-sm mt-2">This round has started. Wait here for the next round.</p>
              </div>
            )}
          </div>
          {winner && (
            <div className="w-full rounded-2xl bg-emerald-900/70 border border-emerald-500/60 px-4 py-2 text-xs text-emerald-100">
              {winner} called BINGO!
            </div>
          )}
        </div>
      </div>
      {bingoError && (
        <p className="mt-2 text-sm text-amber-400 text-center" role="alert">
          {bingoError}
        </p>
      )}
    </div>
  );
};

export default Game;
