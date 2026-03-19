import React, { useEffect, useState } from 'react';
import api from '../services/api';

const StatCard = ({ label, value, sub }) => (
  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
    <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-xl font-semibold mt-1">{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
  </div>
);

const formatETB = (n) => {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return `${new Intl.NumberFormat().format(safe)} ETB`;
};

const formatCompactNumber = (n) => {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat().format(safe);
};

const formatDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
};

const RevenueBars = ({ points, loading }) => {
  const safePoints = Array.isArray(points) ? points : [];
  const max = Math.max(1, ...safePoints.map((p) => Number(p?.revenue) || 0));

  return (
    <div className="h-48 rounded-xl bg-slate-800/60 border border-dashed border-slate-700 p-3 flex flex-col justify-between">
      {safePoints.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
          {loading ? 'Loading…' : 'No data'}
        </div>
      ) : (
        <div className="flex-1 flex items-end gap-2">
          {safePoints.map((p) => {
            const revenue = Number(p?.revenue) || 0;
            const heightPct = (revenue / max) * 100;
            const label = String(p?.label ?? '');
            return (
              <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className="w-full bg-emerald-500/60 rounded-t"
                  style={{ height: `${Math.max(3, heightPct)}%` }}
                  title={`${label}: ${revenue} ETB`}
                />
                <span className="text-[9px] text-slate-500 truncate max-w-[44px]" title={label}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const RevenuePage = () => {
  const [period, setPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const periodLabel =
    period === 'daily'
      ? 'Daily financial report'
      : period === 'weekly'
      ? 'Weekly financial report'
      : 'Monthly financial report';

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError('');
        setReport(null);
        const res = await api.get('/api/admin/revenue', { params: { period } });
        setReport(res.data || null);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load report');
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [period]);

  const totals = report?.totals || {};
  const deposits = report?.deposits || [];
  const withdrawals = report?.withdrawals || [];
  const gameFees = report?.gameFees || [];
  const agentCommissions = report?.agentCommissions || [];
  const chartPoints = report?.chart?.points || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-100">{periodLabel}</h2>
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
        <StatCard label="Total revenue" value={formatETB(totals.totalRevenue)} />
        <StatCard label="Total payouts" value={formatETB(totals.totalPayouts)} />
        <StatCard label="Platform profit" value={formatETB(totals.platformProfit)} />
        <StatCard
          label="Avg profit / game"
          value={`${formatCompactNumber(totals.avgProfitPerGame)} ETB`}
        />
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-200">Revenue chart</span>
          <span className="text-[10px] text-slate-500">{loading ? 'Loading…' : 'From backend'}</span>
        </div>
        <RevenueBars points={chartPoints} loading={loading} />
      </div>

      {/* Detail tables */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Deposits & Withdrawals */}
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">Deposits</span>
              <span className="text-[10px] text-slate-500">
                {loading ? 'Loading…' : `${deposits.length} rows`}
              </span>
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
                {deposits.slice(0, 8).map((d) => (
                  <tr key={d._id}>
                    <td className="px-3 py-1.5">
                      {d.user?.username ? `@${d.user.username}` : d.user?.telegramId || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {Number(d.amount) || 0} ETB
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">{formatDateTime(d.time)}</td>
                  </tr>
                ))}
                {!loading && deposits.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
                      No deposits for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">Withdrawals</span>
              <span className="text-[10px] text-slate-500">
                {loading ? 'Loading…' : `${withdrawals.length} rows`}
              </span>
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
                {withdrawals.slice(0, 8).map((w) => (
                  <tr key={w._id}>
                    <td className="px-3 py-1.5">
                      {w.user?.username ? `@${w.user.username}` : w.user?.telegramId || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {Number(w.amount) || 0} ETB
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">{formatDateTime(w.time)}</td>
                  </tr>
                ))}
                {!loading && withdrawals.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
                      No withdrawals for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Game fees & agent commissions */}
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">Game fees</span>
              <span className="text-[10px] text-slate-500">Platform share per game</span>
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
                {gameFees.slice(0, 8).map((g) => {
                  const gameId = g.gameId ? String(g.gameId).slice(-6) : '';
                  return (
                    <tr key={String(g.gameId || gameId || 'unknown')}>
                      <td className="px-3 py-1.5">#{gameId || '—'}</td>
                      <td className="px-3 py-1.5 text-right">{formatCompactNumber(g.stake)} ETB</td>
                      <td className="px-3 py-1.5 text-right font-semibold">
                        {formatCompactNumber(g.platformFee)} ETB
                      </td>
                    </tr>
                  );
                })}
                {!loading && gameFees.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
                      No game fees for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200">Agent commissions</span>
              <span className="text-[10px] text-slate-500">
                {loading ? 'Loading…' : `${agentCommissions.length} rows`}
              </span>
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
                {agentCommissions.slice(0, 8).map((a) => (
                  <tr key={a.agent}>
                    <td className="px-3 py-1.5">{a.agent}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {formatCompactNumber(a.commission)} ETB
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">{a.period}</td>
                  </tr>
                ))}
                {!loading && agentCommissions.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
                      No agent commissions for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-900/30 border border-rose-700/50 px-4 py-3 text-xs text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
};

export default RevenuePage;

