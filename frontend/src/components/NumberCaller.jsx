import React from 'react';

const NumberCaller = ({ currentNumber, playersCount, prizePool }) => {
  const label = currentNumber?.label || 'B-12';

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-700 px-4 py-3 mb-4 flex items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-bingoPurple to-bingoPink flex items-center justify-center text-white text-lg font-extrabold shadow-lg shadow-bingoPink/50">
          {label}
        </div>
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">
            Current Number
          </p>
          <p className="text-xs text-slate-100">Watch the board light up</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-right">
          <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">
            Players
          </p>
          <p className="text-xs font-semibold text-white">{playersCount}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">
            Prize Pool
          </p>
          <p className="text-xs font-semibold text-bingoGold">
            {prizePool} ETB
          </p>
        </div>
      </div>
    </div>
  );
};

export default NumberCaller;

