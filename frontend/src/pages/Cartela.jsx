import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CartelaNumberGrid from '../components/CartelaNumberGrid';
import BingoBoard from '../components/BingoBoard';
import socket from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { useGameState } from '../hooks/useGameState';

const columnRanges = [
  { from: 1, to: 15 },
  { from: 16, to: 30 },
  { from: 31, to: 45 },
  { from: 46, to: 60 },
  { from: 61, to: 75 },
];

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

const Cartela = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const telegramId = user?.id ?? null;
  const { roomId: locRoomId, entryFee: locEntryFee } = location.state || {};
  const { state, loading: gameStateLoading, refetch } = useGameState(telegramId, locRoomId || undefined);
  const {
    roomId: stateGameId,
    entryFee: stateStake,
    roundStatus,
    myCartelaNumber: stateCartela,
    myCartelaId: stateCartelaId,
    myCartelaIds: stateCartelaIds,
    cartelaPool,
    selectedForRound,
    prizePool,
    winnerPrize,
    numberOfPlayers,
    platformFeePercent,
  } = state || {};

  const roomId = locRoomId || stateGameId;
  const entryFee = locEntryFee ?? stateStake;

  const usePool = Array.isArray(cartelaPool) && cartelaPool.length > 0;
  const poolSize = usePool ? cartelaPool.length : 200;

  /** True when REST game state has enough cartela-selection data to unlock the grid (primary unlock path). */
  const hasRestCartelaData = useMemo(() => {
    if (gameStateLoading || !state || !roomId) return false;
    if (String(state.gameId) !== String(roomId)) return false;
    if (state.roundStatus !== 'cartela_selection') return false;
    const pool = Array.isArray(state.cartelaPool) && state.cartelaPool.length > 0;
    if (pool) return Array.isArray(state.selectedForRound);
    return true;
  }, [gameStateLoading, state, roomId]);
  const maxCartelasPerPlayer = 4;

  const [selectedCartelas, setSelectedCartelas] = useState(() => {
    if (usePool && Array.isArray(stateCartelaIds) && stateCartelaIds.length) return [...stateCartelaIds];
    if (stateCartelaId != null || stateCartela != null) return [stateCartelaId ?? stateCartela].filter((x) => x != null);
    return [];
  });
  const [previewCartelaId, setPreviewCartelaId] = useState(stateCartelaId ?? stateCartela ?? null);
  const [takenCartelas, setTakenCartelas] = useState(() => {
    return [];
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    const r = state?.countdownRemaining;
    return typeof r === 'number' && r >= 0 ? r : null;
  });
  const [selectError, setSelectError] = useState(null);
  const [notEnoughPlayers, setNotEnoughPlayers] = useState(null);
  const hasNavigatedRef = useRef(false);
  const inFlightRef = useRef(new Set());
  const [cartelaStateLoaded, setCartelaStateLoaded] = useState(false);

  // Prize stats are updated via Socket.IO (`prizes_updated`) during cartela selection.
  const [prizeStats, setPrizeStats] = useState(() => ({
    numberOfPlayers: state?.numberOfPlayers ?? 0,
    winnerPrize: state?.winnerPrize ?? 0,
    prizePool: state?.prizePool ?? 0,
  }));

  useEffect(() => {
    // Sync from initial fetch (or when user/room changes)
    setPrizeStats((prev) => ({
      ...prev,
      numberOfPlayers: state?.numberOfPlayers ?? prev.numberOfPlayers,
      winnerPrize: state?.winnerPrize ?? prev.winnerPrize,
      prizePool: state?.prizePool ?? prev.prizePool,
    }));
  }, [state?.numberOfPlayers, state?.winnerPrize, state?.prizePool]);

  const displayCartelaId = previewCartelaId ?? (selectedCartelas.length ? selectedCartelas[0] : null);

  const selectedIdsForBoards = useMemo(() => {
    if (Array.isArray(selectedCartelas) && selectedCartelas.length) return selectedCartelas;
    if (usePool && Array.isArray(stateCartelaIds) && stateCartelaIds.length) return stateCartelaIds;
    if (!usePool && (stateCartelaId != null || stateCartela != null)) {
      return [stateCartelaId ?? stateCartela].filter((x) => x != null);
    }
    return [];
  }, [usePool, selectedCartelas, stateCartelaIds, stateCartelaId, stateCartela]);

  const boardsForSelected = useMemo(() => {
    if (!selectedIdsForBoards.length) return [];
    if (usePool) {
      return selectedIdsForBoards
        .map((id) => {
          const entry = cartelaPool.find((c) => c.cartelaId === id);
          if (!entry?.numbers) return null;
          const board = entry.numbers.map((row) =>
            row.map((val) => (val == null ? { value: null, isFree: true } : { value: val, isFree: false }))
          );
          return { id, board };
        })
        .filter(Boolean);
    }
    return selectedIdsForBoards.map((id) => ({
      id,
      board: buildCartelaBoard(id),
    }));
  }, [usePool, selectedIdsForBoards, cartelaPool]);

  useEffect(() => {
    if (usePool && Array.isArray(stateCartelaIds) && stateCartelaIds.length) {
      setSelectedCartelas((prev) => (prev.length === 0 ? [...stateCartelaIds] : prev));
      if (previewCartelaId == null) setPreviewCartelaId(stateCartelaIds[0]);
    } else if (!usePool && (stateCartelaId != null || stateCartela != null)) {
      setSelectedCartelas((prev) => (prev.length === 0 ? [stateCartelaId ?? stateCartela] : prev));
      if (previewCartelaId == null) setPreviewCartelaId(stateCartelaId ?? stateCartela);
    }
  }, [usePool, stateCartelaId, stateCartela, stateCartelaIds, previewCartelaId]);

  useEffect(() => {
    // Lock until REST or socket provides authoritative cartela state for this room (runs before REST unlock below).
    setCartelaStateLoaded(false);
  }, [roomId, usePool]);

  useEffect(() => {
    if (!hasRestCartelaData || !state) return;
    const pool = Array.isArray(state.cartelaPool) && state.cartelaPool.length > 0;
    if (pool && Array.isArray(state.selectedForRound)) {
      setTakenCartelas(state.selectedForRound.map((s) => s.cartelaId).filter((id) => id != null));
    }
    setCartelaStateLoaded(true);
  }, [hasRestCartelaData, state]);

  useEffect(() => {
    const r = state?.countdownRemaining;
    if (typeof r === 'number' && r >= 0) setTimeLeft(r);
  }, [state?.countdownRemaining]);

  useEffect(() => {
    if (!notEnoughPlayers || notEnoughPlayers.countdown <= 0) return;
    const t = setInterval(() => {
      setNotEnoughPlayers((prev) => {
        if (!prev) return null;
        if (prev.countdown <= 1) return null;
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [notEnoughPlayers?.countdown]);

  const initRoom = useCallback(() => {
    if (!roomId) return;
    socket.emit('join_room', { roomId });
    socket.emit('watch_cartelas', { roomId });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return undefined;

    if (!socket.connected) {
      socket.connect();
    } else {
      initRoom();
    }

    const onConnect = () => {
      initRoom();
    };
    const onReconnect = () => {
      initRoom();
      refetch();
    };

    socket.on('connect', onConnect);
    socket.on('reconnect', onReconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('reconnect', onReconnect);
    };
  }, [roomId, socket.connected, initRoom, refetch]);

  useEffect(() => {
    if (!roomId || cartelaStateLoaded) return undefined;
    const t = setTimeout(() => {
      if (!socket.connected) socket.connect();
      socket.emit('watch_cartelas', { roomId });
    }, 2000);
    return () => clearTimeout(t);
  }, [roomId, cartelaStateLoaded]);

  useEffect(() => {
    if (!roomId) return undefined;
    const handleState = (payload) => {
      if (payload?.gameId != null && String(payload.gameId) !== String(roomId)) return;
      if (payload?.taken) setTakenCartelas(Array.isArray(payload.taken) ? payload.taken : []);
      setCartelaStateLoaded(true);
    };
    const handleTaken = (payload) => {
      const id = payload?.cartelaId != null ? payload.cartelaId : payload?.cartelaNumber;
      if (typeof id === 'number') {
        inFlightRef.current.delete(id);
        setTakenCartelas((prev) => (prev.includes(id) ? prev : [...prev, id]));
      }
    };
    const handleDeselected = (payload) => {
      const id = payload?.cartelaId;
      if (typeof id !== 'number') return;
      inFlightRef.current.delete(id);
      setTakenCartelas((prev) => prev.filter((n) => n !== id));
      setSelectedCartelas((prev) => {
        const next = prev.filter((n) => n !== id);
        setPreviewCartelaId((p) => (p === id ? (next[0] ?? null) : p));
        return next;
      });
    };
    const handleCountdown = (payload) => {
      if (payload?.gameId === roomId && typeof payload.remainingSeconds === 'number') {
        setTimeLeft(payload.remainingSeconds);
        setNotEnoughPlayers((prev) => (prev ? null : prev));
      }
    };
    const handleRoundPlaying = (payload) => {
      if (payload?.gameId !== roomId || hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      refetch();
      const ids = selectedCartelas.length ? selectedCartelas : (stateCartelaIds ?? []);
      navigate('/game', {
        state: { roomId, entryFee, cartelaNumber: usePool ? undefined : (ids[0] ?? stateCartela), cartelaId: usePool ? (ids[0] ?? stateCartelaId) : undefined, cartelaIds: usePool ? ids : undefined },
        replace: true,
      });
    };
    const handleRoundSkippedNoPlayers = (payload) => {
      if (payload?.gameId !== roomId || hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
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
    const handleNotEnoughPlayers = (payload) => {
      if (payload?.gameId !== roomId || hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      navigate('/win', {
        state: {
          roomId,
          entryFee,
          noPlayers: true,
          messageAmharic: payload.messageAmharic || 'በዚህ ዙር ምንም በቂ ተጫዋች አልተቀላቀለም። አዲስ ዙር በቅርቡ ይጀምራል።',
          messageEnglish: payload.messageEnglish || 'Not enough players joined this round. A new round will start shortly.',
        },
        replace: true,
      });
    };
    const handlePrizesUpdated = (payload) => {
      if (payload?.gameId !== roomId) return;
      setPrizeStats((prev) => ({
        ...prev,
        numberOfPlayers: payload.numberOfPlayers ?? prev.numberOfPlayers,
        winnerPrize: payload.winnerPrize ?? prev.winnerPrize,
        prizePool: payload.prizePool ?? prev.prizePool,
      }));
    };
    socket.on('cartela_state', handleState);
    socket.on('cartela_selected', handleTaken);
    socket.on('cartela_reserved', handleTaken);
    socket.on('cartela_deselected', handleDeselected);
    socket.on('countdown_update', handleCountdown);
    socket.on('round_playing', handleRoundPlaying);
    socket.on('round_skipped_no_players', handleRoundSkippedNoPlayers);
    socket.on('round_skipped_not_enough_players', handleNotEnoughPlayers);
    socket.on('prizes_updated', handlePrizesUpdated);
    return () => {
      socket.off('cartela_state', handleState);
      socket.off('cartela_selected', handleTaken);
      socket.off('cartela_reserved', handleTaken);
      socket.off('cartela_deselected', handleDeselected);
      socket.off('countdown_update', handleCountdown);
      socket.off('round_playing', handleRoundPlaying);
      socket.off('round_skipped_no_players', handleRoundSkippedNoPlayers);
      socket.off('round_skipped_not_enough_players', handleNotEnoughPlayers);
      socket.off('prizes_updated', handlePrizesUpdated);
    };
  }, [roomId, refetch, navigate, selectedCartelas, previewCartelaId, stateCartela, stateCartelaId, usePool]);

  if (state && roundStatus === 'playing') {
    const ids = selectedCartelas.length ? selectedCartelas : (stateCartelaIds ?? (stateCartelaId != null ? [stateCartelaId] : []));
    navigate('/game', {
      state: {
        roomId,
        entryFee,
        cartelaNumber: usePool ? undefined : (stateCartela ?? ids[0]),
        cartelaId: usePool ? (ids[0] ?? stateCartelaId) : undefined,
        cartelaIds: usePool ? ids : undefined,
      },
      replace: true,
    });
    return null;
  }
  if (state && roundStatus === 'winner') {
    const winners = Array.isArray(state?.roundWinners) && state.roundWinners.length > 0
      ? state.roundWinners
      : (state?.roundWinner ? [state.roundWinner] : undefined);
    navigate('/win', {
      state: { roomId, entryFee, roundWinner: state?.roundWinner, winners, roundWinners: state?.roundWinners },
      replace: true,
    });
    return null;
  }

  const uiLocked = !cartelaStateLoaded;

  const handleSelectCartela = (num) => {
    setSelectError(null);
    if (uiLocked) return;
    if (usePool) {
      if (inFlightRef.current.has(num)) return;
      if (selectedCartelas.includes(num)) {
        inFlightRef.current.add(num);
        socket.emit('deselect_cartela', { roomId, cartelaId: num, telegramId });
        setSelectedCartelas((prev) => {
          const next = prev.filter((n) => n !== num);
          setPreviewCartelaId((p) => (p === num ? (next[0] ?? null) : p));
          return next;
        });
        socket.once('cartela_deselect_failed', (payload) => {
          if (payload?.cartelaId === num) {
            inFlightRef.current.delete(num);
            setSelectedCartelas((prev) => (prev.includes(num) ? prev : [...prev, num]));
          }
          if (payload?.reason) setSelectError(payload.message || 'Could not deselect.');
        });
        return;
      }
      if (takenCartelas.includes(num) && !selectedCartelas.includes(num)) return;
      if (selectedCartelas.length >= maxCartelasPerPlayer) {
        setSelectError('You can select up to 4 cartelas per round.');
        return;
      }
      inFlightRef.current.add(num);
      socket.emit('select_cartela', { roomId, cartelaId: num, telegramId });
      setSelectedCartelas((prev) => [...prev, num]);
      setTakenCartelas((prev) => (prev.includes(num) ? prev : [...prev, num]));
      setPreviewCartelaId(num);
      socket.once('cartela_select_failed', (payload) => {
        if (payload?.cartelaId === num || payload?.cartelaNumber === num) {
          inFlightRef.current.delete(num);
          setSelectedCartelas((prev) => prev.filter((n) => n !== num));
          setTakenCartelas((prev) => prev.filter((n) => n !== num));
        }
        const msg = payload?.reason === 'insufficient_balance' || payload?.message
          ? (payload.message || 'Insufficient balance to select a cartela.')
          : payload?.reason === 'max_cartelas_reached'
          ? (payload.message || 'You can select up to 4 cartelas per round.')
          : payload?.reason === 'already_selected_by_you'
          ? (payload.message || 'You already selected this cartela.')
          : payload?.reason === 'already_taken'
          ? (payload.message || 'This cartela is already taken. Please select another.')
          : null;
        if (msg) setSelectError(msg);
      });
      return;
    }
    if (inFlightRef.current.has(num)) return;
    if (takenCartelas.includes(num)) return;
    if (selectedCartelas.length) return;
    inFlightRef.current.add(num);
    socket.emit('select_cartela', { roomId, cartelaNumber: num, telegramId });
    setSelectedCartelas([num]);
    setPreviewCartelaId(num);
    socket.once('cartela_select_failed', (payload) => {
      if (payload?.cartelaNumber === num) {
        inFlightRef.current.delete(num);
        setSelectedCartelas([]);
      }
      const msg =
        payload?.reason === 'insufficient_balance' || payload?.message
          ? (payload.message || 'Insufficient balance to select a cartela.')
          : payload?.reason === 'already_taken'
          ? (payload.message || 'This cartela is already taken. Please select another.')
          : payload?.reason === 'already_selected_by_you'
          ? (payload.message || 'You already selected this cartela.')
          : null;
      if (msg) setSelectError(msg);
    });
  };

  const yourSelectedCount = selectedCartelas.length;

  const winPrize = prizeStats.numberOfPlayers >= 2 ? (prizeStats.winnerPrize ?? null) : null;

  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        No game session. Return to lobby.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => navigate('/lobby')}
          className="flex items-center gap-2 rounded-xl bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700/80 active:scale-[0.98] transition"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Lobby
        </button>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-xl bg-slate-700/90 hover:bg-slate-600 border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 active:scale-[0.98] transition"
        >
          <span aria-hidden>🔄</span> Refresh
        </button>
      </div>
      {notEnoughPlayers && (
        <div className="mb-4 rounded-2xl bg-amber-900/40 border border-amber-500/50 px-4 py-3 text-center">
          <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-line">{notEnoughPlayers.messageAmharic}</p>
          <p className="text-slate-400 text-xs mt-2">{notEnoughPlayers.messageEnglish}</p>
          {notEnoughPlayers.countdown != null && notEnoughPlayers.countdown > 0 && (
            <p className="text-amber-300 text-xs font-medium mt-2">Next round in {notEnoughPlayers.countdown}s...</p>
          )}
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Select up to 4 cartelas (click again to deselect)</p>
          <p className="text-sm text-slate-100">
            Entry {entryFee ?? '--'} ETB each · {selectedCartelas.length}/4 selected
          </p>
        </div>
      </div>

      {selectError && (
        <p className="mb-3 text-sm text-amber-400 text-center" role="alert">
          {selectError}
        </p>
      )}
      <div className="mb-4">
        <CartelaNumberGrid
          max={poolSize}
          selectedNumbers={selectedCartelas}
          disabledNumbers={takenCartelas.filter((n) => !selectedCartelas.includes(n))}
          availableCount={poolSize - takenCartelas.length}
          selectedCount={yourSelectedCount}
          timeLeft={timeLeft}
          winPrize={winPrize}
          disableAll={uiLocked}
          onSelect={handleSelectCartela}
        />
      </div>

      {boardsForSelected.length > 0 && (
        <div className="mt-4 flex flex-col items-center gap-3">
          {boardsForSelected.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1">
              <BingoBoard board={b.board} marked={new Set(['2-2'])} currentNumber={null} />
              <div className="text-[11px] text-slate-300">Cartela #{b.id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Cartela;
