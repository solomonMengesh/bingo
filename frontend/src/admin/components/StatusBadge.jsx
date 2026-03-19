import React from 'react';

const toneMap = {
  success: {
    base: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/60',
    dot: 'bg-emerald-300',
    pulse: 'animate-pulse',
  },
  warning: {
    base: 'bg-amber-500/15 text-amber-300 border-amber-400/60',
    dot: 'bg-amber-300',
  },
  danger: {
    base: 'bg-rose-500/15 text-rose-300 border-rose-400/60',
    dot: 'bg-rose-300',
  },
  info: {
    base: 'bg-sky-500/15 text-sky-300 border-sky-400/60',
    dot: 'bg-sky-300',
  },
  neutral: {
    base: 'bg-slate-700/40 text-slate-200 border-slate-500/60',
    dot: 'bg-slate-300',
  },
};

const StatusBadge = ({ label, tone = 'neutral', pulse = false, className = '' }) => {
  const config = toneMap[tone] || toneMap.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border uppercase tracking-wide ${config.base} ${
        pulse ? config.pulse || 'animate-pulse' : ''
      } ${className}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
};

export default StatusBadge;

