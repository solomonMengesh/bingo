import React from 'react';
import { useNavigate } from 'react-router-dom';
import WalletSummary from '../components/WalletSummary';

const Wallet = () => {
  const navigate = useNavigate();

  const handleWithdraw = () => {
    // This will be wired to backend later.
    alert('Withdraw flow will open here once backend is connected.');
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Wallet
          </p>
          <p className="text-sm text-slate-100">
            Manage your Bingo balance
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xs text-slate-400 underline"
        >
          Back
        </button>
      </div>

      <WalletSummary onWithdraw={handleWithdraw} />
    </div>
  );
};

export default Wallet;

