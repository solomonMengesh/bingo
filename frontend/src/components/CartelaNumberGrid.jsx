import React from 'react';

const CartelaNumberGrid = ({
  max = 200,
  selectedNumber,
  selectedNumbers,
  disabledNumbers = [],
  onSelect,
  availableCount,
  selectedCount,
  timeLeft,
  winPrize,
  disableAll = false,
}) => {
  const numbers = Array.from({ length: max }, (_, i) => i + 1);

  const isNumSelected = (num) => {
    if (Array.isArray(selectedNumbers)) {
      return selectedNumbers.includes(num);
    }
    return num === selectedNumber;
  };

  return (
    <div className="w-full rounded-3xl bg-[#020817] border border-slate-800 shadow-bingo-card overflow-hidden mx-2">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#02101f] text-[11px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-300">
            Your cartelas:{' '}
            <span className="text-emerald-300 font-semibold">
              {typeof selectedCount === 'number'
                ? selectedCount
                : 0}
            </span>
          </span>
          <span className="text-slate-300">
            Available cartela:{' '}
            <span className="text-emerald-300 font-semibold">
              {availableCount ?? numbers.length - disabledNumbers.length}
            </span>
          </span>
        </div>
        {winPrize != null && (
          <span className="text-emerald-300 font-semibold">
            Prize: {winPrize} ETB
          </span>
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

      <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-1.5 bg-[#020817] p-3 max-h-[420px] overflow-y-auto">
        {numbers.map((num) => {
          const selected = isNumSelected(num);
          const disabled = disableAll
            ? true
            : (Array.isArray(disabledNumbers) ? disabledNumbers.includes(num) : false);
          return (
            <button
              key={num}
              type="button"
              onClick={() => {
                if (disabled) return;
                onSelect?.(num);
              }}
              className={`h-9 w-9 flex items-center justify-center text-[10px] font-semibold rounded-xl transition
                ${
                  disabled
                    ? 'bg-slate-900 text-slate-500 cursor-not-allowed opacity-60'
                    : selected
                    ? 'bg-rose-600 text-white shadow-[0_0_0_1px_rgba(248,113,113,0.9)]'
                    : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                }
              `}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CartelaNumberGrid;

