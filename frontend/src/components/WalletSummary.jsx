import React from 'react';
import { useAuth } from '../context/AuthContext';

const WalletSummary = ({ onWithdraw }) => {
  const { balance } = useAuth();
  const mockHistory = ['+50 ETB', '+20 ETB', '+10 ETB'];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-bingoPurple to-bingoPink p-4 shadow-bingo-card">
        <p className="text-xs uppercase tracking-wide text-white/80">
          Balance
        </p>
        <p className="text-2xl font-bold text-white mt-1">
          {balance.toFixed(2)} ETB
        </p>
      </div>

      <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
          Deposit history
        </p>
        <div className="space-y-1 text-sm">
          {mockHistory.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-slate-100"
            >
              <span>{entry}</span>
              <span className="text-[0.7rem] text-slate-500">Today</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onWithdraw}
        className="w-full rounded-2xl border border-bingoGold text-bingoGold font-semibold py-3 mt-2 active:scale-[0.98] transition bg-slate-950/60 hover:bg-slate-900/80"
      >
        Withdraw
      </button>
    </div>
  );
};

export default WalletSummary;

