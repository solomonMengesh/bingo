import React from 'react';

const StatCard = ({ label, value }) => (
  <div className="flex-1 rounded-2xl bg-slate-900/90 border border-slate-800 px-3 py-2 flex flex-col justify-center">
    <span className="text-[10px] uppercase tracking-wide text-slate-400">
      {label}
    </span>
    <span className="text-xs sm:text-sm font-semibold text-slate-50">
      {value}
    </span>
  </div>
);

const CallerStats = ({ derash, winnerPrize, players, stake, call, soundOn, onToggleSound }) => {
  const prizeValue = winnerPrize ?? derash;
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="grid grid-cols-4 gap-2 flex-1 min-w-0">
        <StatCard label="Derash" value={`${prizeValue} ETB`} />
        <StatCard label="Players" value={players} />
        <StatCard label="Stake" value={`${stake} ETB`} />
        <StatCard label="Call" value={call} />
      </div>
      {onToggleSound && (
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={soundOn ? 'Sound on' : 'Sound off'}
          className={`shrink-0 w-9 h-9 rounded-full shadow-md flex items-center justify-center text-xs font-semibold ${
            soundOn ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'
          }`}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      )}
    </div>
  );
};

export default CallerStats;

