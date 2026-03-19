import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BingoBoard from '../components/BingoBoard';
import socket from '../services/socket';

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

const maskPhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\s+/g, '');
  if (digits.length <= 4) return digits;
  const first = digits.slice(0, 4);
  const last = digits.slice(-2);
  return `${first}***${last}`;
};

const buildWinningPattern = (board, marked) => {
  if (!board || !Array.isArray(board) || !(marked instanceof Set)) return new Set();
  const pattern = new Set();

  const allMarked = (cells) => cells.every(([r, c]) => marked.has(`${r}-${c}`));

  // rows
  for (let r = 0; r < 5; r += 1) {
    const cells = Array.from({ length: 5 }, (_, c) => [r, c]);
    if (allMarked(cells)) {
      cells.forEach(([rr, cc]) => pattern.add(`${rr}-${cc}`));
      return pattern;
    }
  }
  // columns
  for (let c = 0; c < 5; c += 1) {
    const cells = Array.from({ length: 5 }, (_, r) => [r, c]);
    if (allMarked(cells)) {
      cells.forEach(([rr, cc]) => pattern.add(`${rr}-${cc}`));
      return pattern;
    }
  }
  // main diagonal
  {
    const cells = Array.from({ length: 5 }, (_, i) => [i, i]);
    if (allMarked(cells)) {
      cells.forEach(([rr, cc]) => pattern.add(`${rr}-${cc}`));
      return pattern;
    }
  }
  // anti-diagonal
  {
    const cells = Array.from({ length: 5 }, (_, i) => [i, 4 - i]);
    if (allMarked(cells)) {
      cells.forEach(([rr, cc]) => pattern.add(`${rr}-${cc}`));
      return pattern;
    }
  }

  return pattern;
};

const Win = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};
  const {
    roomId,
    entryFee,
    prizePool,
    cartelaNumber,
    board: stateBoard,
    winnerBoard: stateWinnerBoard,
    calledNumbers,
    roundWinner,
    winners: stateWinners,
    roundWinners: stateRoundWinners,
    noPlayers,
    messageAmharic,
    messageEnglish,
  } = state;

  const isNoPlayersRound = noPlayers === true;
  const rawWinners = Array.isArray(stateWinners) && stateWinners.length > 0
    ? stateWinners
    : (Array.isArray(stateRoundWinners) && stateRoundWinners.length > 0 ? stateRoundWinners : null);
  const winnersList = rawWinners ?? (roundWinner ? [roundWinner] : []);
  const isTied = winnersList.length > 1;
  const winnerInfo = roundWinner || winnersList[0] || {
    username: 'Winner',
    phone: null,
    cartelaNumber,
    prizeAmount: prizePool,
  };
  const board = stateBoard || stateWinnerBoard || buildCartelaBoard(winnerInfo.cartelaNumber);
  const marked = buildMarkedFromCalled(board, calledNumbers);
  const winningPattern = buildWinningPattern(board, marked);

  const [timeLeft, setTimeLeft] = useState(10);
  const hasNavigatedRef = useRef(false);

  const goToCartelaSelection = useCallback(
    (gameId) => {
      const id = gameId || roomId;
      if (hasNavigatedRef.current || !id) return;
      hasNavigatedRef.current = true;
      navigate('/cartela', { state: { roomId: id, entryFee }, replace: true });
    },
    [roomId, entryFee, navigate]
  );

  useEffect(() => {
    if (!socket.connected) socket.connect();
    if (roomId) socket.emit('join_room', { roomId });
    const onRoundStarted = (payload) => {
      if (payload?.gameId) goToCartelaSelection(payload.gameId);
    };
    const onRoundReset = (payload) => {
      if (payload?.gameId) goToCartelaSelection(payload.gameId);
    };
    socket.on('round_started', onRoundStarted);
    socket.on('round_reset', onRoundReset);
    return () => {
      socket.off('round_started', onRoundStarted);
      socket.off('round_reset', onRoundReset);
    };
  }, [goToCartelaSelection, roomId]);

  useEffect(() => {
    setTimeLeft(10);
    hasNavigatedRef.current = false;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          goToCartelaSelection(roomId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [roomId, entryFee, goToCartelaSelection]);

  if (isNoPlayersRound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl bg-slate-900/95 border border-slate-600 shadow-bingo-card px-5 py-6 text-center">
          <p className="text-lg text-slate-200 leading-relaxed mb-2">
            {messageAmharic || 'በዚህ ዙር ምንም ተጫዋች አልተቀላቀለም። አዲስ ዙር በቅርቡ ይጀምራል።'}
          </p>
          <p className="text-sm text-slate-400 mb-4">
            {messageEnglish || 'No players joined this round. A new round will start shortly.'}
          </p>
          <div className="text-[11px] text-slate-400">
            Next round in <span className="font-semibold text-emerald-300">{timeLeft}s</span>...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900/95 border border-emerald-500/70 shadow-bingo-card px-5 py-6 text-center">
        <h1 className="text-2xl font-extrabold text-emerald-300 tracking-[0.35em] mb-2">BINGO!</h1>
        {isTied ? (
          <>
            <p className="text-xs text-slate-200 mb-1 font-semibold">Tied! {winnersList.length} winners</p>
            <ul className="text-[11px] text-slate-300 mb-2 list-none space-y-1">
              {winnersList.map((w, i) => (
                <li key={i}>
                  <span className="font-medium">{w.username || 'Winner'}</span>
                  {w.phone && <span className="text-slate-500 ml-1">· {maskPhone(w.phone)}</span>}
                  <span className="block text-slate-400">Cartela #{w.cartelaId ?? w.cartelaNumber} — {(w.prizeAmount ?? 0)} ETB</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-200 mb-1 font-semibold">
              {winnerInfo.username || 'Winner'} won this round
            </p>
            {winnerInfo.phone && (
              <p className="text-[11px] text-slate-400 mb-0.5">📱 {maskPhone(winnerInfo.phone)}</p>
            )}
            {(winnerInfo.cartelaNumber != null || winnerInfo.cartelaId != null) && (
              <p className="text-[11px] text-slate-400 mb-2">Cartela #{winnerInfo.cartelaId ?? winnerInfo.cartelaNumber}</p>
            )}
            {(winnerInfo.prizeAmount != null || prizePool != null) && (
              <p className="text-xs text-emerald-300 font-semibold mb-3">
                Prize: {winnerInfo.prizeAmount ?? prizePool} ETB
              </p>
            )}
          </>
        )}
        <p className="text-[11px] text-slate-400 mb-1">Winner&apos;s board</p>
        <div className="flex justify-center mb-3">
          <BingoBoard board={board} marked={marked} highlight={winningPattern} currentNumber={null} onCellClick={undefined} />
        </div>
        <div className="mt-3 text-[11px] text-slate-400">
          Next round in <span className="font-semibold text-emerald-300">{timeLeft}s</span>...
        </div>
      </div>
    </div>
  );
};

export default Win;
