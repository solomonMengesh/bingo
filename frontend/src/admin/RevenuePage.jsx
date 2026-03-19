import React, { useState } from 'react';

const RevenuePage = () => {
  const [period, setPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly'

  const periodLabel =
    period === 'daily'
      ? 'Daily financial report'
      : period === 'weekly'
      ? 'Weekly financial report'
      : 'Monthly financial report';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-100">
          {periodLabel}
        </h2>
        <div className="inline-flex rounded-full bg-slate-900 border border-slate-800 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setPeriod('daily')}
            className={`px-3 py-1 rounded-full ${
              period === 'daily'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setPeriod('weekly')}
            className={`px-3 py-1 rounded-full ${
              period === 'weekly'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`px-3 py-1 rounded-full ${
              period === 'monthly'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* High-level metrics */}
      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Total revenue
          </p>
          <p className="text-xl font-semibold mt-1">120,450 ETB</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Total payouts
          </p>
          <p className="text-xl font-semibold mt-1">102,220 ETB</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Platform profit
          </p>
          <p className="text-xl font-semibold mt-1">18,230 ETB</p>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Avg profit / game
          </p>
          <p className="text-xl font-semibold mt-1">120 ETB</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-200">
            Revenue chart
          </span>
          <span className="text-[10px] text-slate-500">
            Frontend placeholder
          </span>
        </div>
        <div className="h-48 rounded-xl bg-slate-800/60 border border-dashed border-slate-700" />
      </div>

      {/* Detail tables */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Deposits & Withdrawals */}
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">
                Deposits
              </span>
              <span className="text-[10px] text-slate-500">Sample rows</span>
            </div>
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-1.5 text-left">User</th>
                  <th className="px-3 py-1.5 text-right">Amount</th>
                  <th className="px-3 py-1.5 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="px-3 py-1.5">@normalogi</td>
                  <td className="px-3 py-1.5 text-right font-semibold">
                    200 ETB
                  </td>
                  <td className="px-3 py-1.5 text-slate-400">
                    2026-03-12 10:23
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5">@player2</td>
                  <td className="px-3 py-1.5 text-right font-semibold">
                    100 ETB
                  </td>
                  <td className="px-3 py-1.5 text-slate-400">
                    2026-03-11 18:05
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">
                Withdrawals
              </span>
              <span className="text-[10px] text-slate-500">Sample rows</span>
            </div>
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-1.5 text-left">User</th>
                  <th className="px-3 py-1.5 text-right">Amount</th>
                  <th className="px-3 py-1.5 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="px-3 py-1.5">@normalogi</td>
                  <td className="px-3 py-1.5 text-right font-semibold">
                    300 ETB
                  </td>
                  <td className="px-3 py-1.5 text-slate-400">
                    2026-03-12 11:05
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Game fees & agent commissions */}
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">
                Game fees
              </span>
              <span className="text-[10px] text-slate-500">
                Platform share per game
              </span>
            </div>
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-1.5 text-left">Game ID</th>
                  <th className="px-3 py-1.5 text-right">Stake</th>
                  <th className="px-3 py-1.5 text-right">Platform fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="px-3 py-1.5">#57</td>
                  <td className="px-3 py-1.5 text-right">20 ETB</td>
                  <td className="px-3 py-1.5 text-right font-semibold">
                    120 ETB
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-1.5">#56</td>
                  <td className="px-3 py-1.5 text-right">10 ETB</td>
                  <td className="px-3 py-1.5 text-right font-semibold">
                    80 ETB
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">
                Agent commissions
              </span>
              <span className="text-[10px] text-slate-500">Sample rows</span>
            </div>
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-1.5 text-left">Agent</th>
                  <th className="px-3 py-1.5 text-right">Commission</th>
                  <th className="px-3 py-1.5 text-left">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="px-3 py-1.5">@agent1</td>
                  <td className="px-3 py-1.5 text-right font-semibold">
                    450 ETB
                  </td>
                  <td className="px-3 py-1.5 text-slate-400">Mar 2026</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenuePage;

