import React from 'react';
import { useAuth } from '../context/AuthContext';

const GoldCoinIcon = () => (
  <svg
    className="w-5 h-5 text-bingoGold animate-coin-pulse flex-shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6v12M9 9a6 6 0 0 0 6 0M9 15a6 6 0 0 1 6 0" strokeWidth="1.2" />
  </svg>
);

const LobbyHeader = () => {
  const { user, balance } = useAuth();
  const name =
    user?.first_name ||
    (user && `${user.first_name || ''} ${user.last_name || ''}`.trim()) ||
    'Player';
  const initials = name
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase() || 'P';

  return (
    <header className="flex items-center justify-between gap-3 mb-5 w-full">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-full bg-cardSurface border border-white/10 flex items-center justify-center flex-shrink-0 font-outfit font-bold text-sm text-white/90"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-wider text-white/50 font-medium">
            Player
          </p>
          <p className="font-outfit font-semibold text-white truncate text-base">
            {name}
          </p>
        </div>
      </div>
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-full flex-shrink-0"
        style={{
          background: 'rgba(22, 27, 34, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
        }}
      >
        <GoldCoinIcon />
        <span className="font-outfit font-bold text-bingoGold text-sm tabular-nums">
          {balance.toFixed(2)} ETB
        </span>
      </div>
    </header>
  );
};

export default LobbyHeader;
