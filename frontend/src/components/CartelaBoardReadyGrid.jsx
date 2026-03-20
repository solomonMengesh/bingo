import React, { useEffect, useMemo, useState, useCallback } from 'react';

/**
 * Client-only preparation: avoids blocking the first paint with sync work and
 * matches production timing where data may arrive after mount.
 */
function defaultBuildNumbers(max) {
  return Array.from({ length: max }, (_, i) => i + 1);
}

/**
 * Simulates optional async work (e.g. fetching pool metadata). Replace with your API.
 */
async function defaultPrepareNumbers(max) {
  await new Promise((r) => {
    setTimeout(r, 0);
  });
  return defaultBuildNumbers(max);
}

/**
 * Cartela number grid that:
 * - Shows a loading state until numbers are prepared on the client
 * - Keeps buttons disabled only while loading (not stuck behind socket/REST)
 * - Preserves hover / selected / disabled styling
 */
export default function CartelaBoardReadyGrid({
  max = 200,
  selectedNumbers = [],
  disabledNumbers = [],
  onSelect,
  availableCount,
  selectedCount,
  timeLeft,
  winPrize,
  /** Async: return number[] (1..max). If omitted, uses a microtask + sync build. */
  prepareNumbers = defaultPrepareNumbers,
  /** Extra lock (e.g. socket not ready) — grid stays loading if true */
  waitForExternal = false,
  className = '',
}) {
  const [phase, setPhase] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null);
  const [numbers, setNumbers] = useState(null);

  const stablePrepare = useCallback(prepareNumbers, [prepareNumbers]);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setError(null);
    setNumbers(null);

    (async () => {
      try {
        const list = await stablePrepare(max);
        if (cancelled) return;
        if (!Array.isArray(list) || list.length === 0) {
          setError(new Error('Invalid number list'));
          setPhase('error');
          return;
        }
        setNumbers(list);
        setPhase('ready');
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [max, stablePrepare]);

  const loading = phase === 'loading' || waitForExternal;
  const ready = phase === 'ready' && !waitForExternal && numbers;

  const isNumSelected = useCallback(
    (num) => Array.isArray(selectedNumbers) && selectedNumbers.includes(num),
    [selectedNumbers]
  );

  const header = useMemo(
    () => (
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#02101f] text-[11px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-300">
            Your cartelas:{' '}
            <span className="text-emerald-300 font-semibold">
              {typeof selectedCount === 'number' ? selectedCount : 0}
            </span>
          </span>
          <span className="text-slate-300">
            Available cartela:{' '}
            <span className="text-emerald-300 font-semibold">
              {availableCount ??
                (numbers ? numbers.length - disabledNumbers.length : '—')}
            </span>
          </span>
        </div>
        {winPrize != null && (
          <span className="text-emerald-300 font-semibold">Prize: {winPrize} ETB</span>
        )}
        {typeof timeLeft === 'number' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-3 py-0.5 font-semibold text-white">
            <span role="img" aria-label="timer">
              ⏱
            </span>
            {timeLeft}s
          </span>
        )}
      </div>
    ),
    [availableCount, disabledNumbers.length, numbers, selectedCount, timeLeft, winPrize]
  );

  return (
    <div
      className={`w-full rounded-3xl bg-[#020817] border border-slate-800 shadow-bingo-card overflow-hidden mx-2 ${className}`}
    >
      {header}

      {loading && (
        <div
          className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-1.5 bg-[#020817] p-3 max-h-[420px] overflow-y-auto"
          aria-busy="true"
          aria-label="Loading cartela numbers"
        >
          {Array.from({ length: Math.min(max, 60) }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className="h-9 w-9 rounded-xl bg-slate-800/80 animate-pulse border border-slate-700/50"
            />
          ))}
        </div>
      )}

      {!loading && phase === 'error' && (
        <div className="p-6 text-center text-sm text-amber-400">
          Could not load cartela numbers.{error?.message ? ` ${error.message}` : ''}
        </div>
      )}

      {ready && (
        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-1.5 bg-[#020817] p-3 max-h-[420px] overflow-y-auto">
          {numbers.map((num) => {
            const selected = isNumSelected(num);
            const disabled = Array.isArray(disabledNumbers) && disabledNumbers.includes(num);
            return (
              <button
                key={num}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onSelect?.(num);
                }}
                className={`h-9 w-9 flex items-center justify-center text-[10px] font-semibold rounded-xl transition
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020817]
                  active:scale-[0.97]
                  ${
                    disabled
                      ? 'bg-slate-900 text-slate-500 cursor-not-allowed opacity-60'
                      : selected
                      ? 'bg-rose-600 text-white shadow-[0_0_0_1px_rgba(248,113,113,0.9)] hover:bg-rose-500'
                      : 'bg-slate-800 text-slate-100 hover:bg-slate-700 hover:shadow-md'
                  }
                `}
              >
                {num}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
