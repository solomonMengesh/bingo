import React from 'react';

const NumberGridBoard = ({ selected = new Set(), onToggle }) => {
  const isSelected = (num) =>
    selected instanceof Set ? selected.has(num) : !!selected[num];

  const handleClick = (num) => {
    if (!onToggle) return;
    onToggle(num);
  };

  const numbers = Array.from({ length: 200 }, (_, i) => i + 1);

  return (
    <div className="w-full rounded-3xl bg-[#020817] border border-slate-800 shadow-bingo-card overflow-hidden mx-2">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#02101f] text-[11px]">
        <span className="inline-flex items-center rounded-full bg-emerald-600/90 px-2 py-0.5 font-semibold text-white">
          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
          Connected
        </span>
        <div className="flex-1 flex items-center justify-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-3 py-0.5 font-semibold text-white">
            <span role="img" aria-label="timer">
              ⏱
            </span>
            30s
          </span>
        </div>
        <div className="text-[11px] text-slate-300">
          Stake:{' '}
          <span className="text-sky-300 font-semibold whitespace-nowrap">
            10 ETB
          </span>
        </div>
      </div>

      <div className="border-b border-teal-700 bg-[#021b2c] px-4 py-1.5 text-center text-[12px] font-semibold text-emerald-300">
        Win: <span className="text-emerald-200">32 ETB</span>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-1.5 bg-[#020817] p-3 max-h-[420px] overflow-y-auto">
        {numbers.map((num) => {
          const selectedCell = isSelected(num);
          return (
            <button
              key={num}
              type="button"
              onClick={() => handleClick(num)}
              className={`h-9 w-9 flex items-center justify-center text-[10px] font-semibold rounded-xl transition
                ${
                  selectedCell
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

export default NumberGridBoard;

