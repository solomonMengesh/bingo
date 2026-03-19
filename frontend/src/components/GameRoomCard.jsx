import React from 'react';
import { motion } from 'framer-motion';

const GameRoomCard = ({
  label,
  roomLabel,
  roundLabel,
  entryFee,
  onClick,
  subtitle,
  disabled,
  isRunning,
  playerCount = 0,
  playerLimit = 12,
}) => {
  const isScheduled = disabled === true;
  const borderGlow = isScheduled ? 'neonCyan' : 'neonRose';
  const progress = playerLimit > 0 ? Math.min(1, playerCount / playerLimit) : 0;

  const content = (
    <>
      <div className="absolute top-3 right-3">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-lg font-outfit font-bold text-xs text-white"
          style={{
            background: 'rgba(251, 191, 36, 0.25)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
          }}
        >
          ENTRY {entryFee} ETB
        </span>
      </div>
      {isRunning && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full bg-neonRose animate-live-dot"
            aria-hidden
          />
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-neonRose">
            Live
          </span>
        </div>
      )}
      <div className="text-left pt-8 pb-3">
        <p className="text-[0.65rem] uppercase tracking-wider text-white/50 font-medium font-outfit mb-0.5">
          {isScheduled ? 'Scheduled' : 'Play Bingo'}
        </p>
        {roomLabel != null && roundLabel == null ? (
          <p className="font-outfit font-bold text-xl text-white leading-tight">
            {roomLabel}
          </p>
        ) : roomLabel != null && roundLabel != null ? (
          <p className="font-outfit font-bold text-white leading-tight">
            <span className="text-xl">{roomLabel}</span>
            <span className="text-sm font-semibold text-white/80 ml-1.5">
              {roundLabel}
            </span>
          </p>
        ) : (
          <p className="font-outfit font-bold text-lg text-white leading-tight">
            {label}
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-white/70 mt-1.5 font-outfit">{subtitle}</p>
        )}
        {isRunning && playerLimit > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[0.65rem] text-white/60 font-outfit mb-1">
              <span>Players joined</span>
              <span className="tabular-nums">
                {playerCount}/{playerLimit}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden bg-white/10"
              role="progressbar"
              aria-valuenow={playerCount}
              aria-valuemin={0}
              aria-valuemax={playerLimit}
            >
              <motion.div
                className="h-full rounded-full bg-neonRose/80"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );

  const cardClass = `
    relative w-full rounded-2xl text-left overflow-hidden
    font-outfit
    border
    ${isScheduled ? 'border-neonCyan/50 shadow-glow-cyan' : 'border-neonRose/50 shadow-glow-rose'}
  `;
  const glassStyle = {
    background: isScheduled
      ? 'rgba(22, 27, 34, 0.6)'
      : 'rgba(22, 27, 34, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

  if (isScheduled) {
    return (
      <div className={cardClass} style={glassStyle}>
        {content}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cardClass}
      style={glassStyle}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
    >
      {content}
    </motion.button>
  );
};

export default GameRoomCard;
