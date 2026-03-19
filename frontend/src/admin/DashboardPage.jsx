import React from 'react';

const StatCard = ({ label, value, sub }) => (
  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-1">
    <span className="text-[11px] uppercase tracking-wide text-slate-400">
      {label}
    </span>
    <span className="text-xl font-semibold text-slate-50">{value}</span>
    {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
  </div>
);

const ChartPlaceholder = ({ title }) => (
  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 w-full min-w-0">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-semibold text-slate-200">{title}</span>
      <span className="text-[10px] text-slate-500">Chart (frontend only)</span>
    </div>
    <div className="h-40 md:h-40 w-full rounded-xl bg-slate-800/60 border border-dashed border-slate-700" />
  </div>
);

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      {/* Stacked on mobile, grid on larger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Total Users" value="1,245" sub="+32 today" />
        <StatCard label="Total Deposits" value="120,450 ETB" sub="All time" />
        <StatCard label="Active Games" value="3" />
        <StatCard label="Pending Deposits" value="7" />
        <StatCard label="Total Revenue" value="18,230 ETB" />
        <StatCard label="Games Today" value="42" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPlaceholder title="Daily revenue" />
        <ChartPlaceholder title="Player growth" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPlaceholder title="Games played" />
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 w-full min-w-0">
          <p className="text-xs font-semibold text-slate-200 mb-3">
            Recent activity
          </p>
          <ul className="space-y-2 text-[11px] text-slate-300">
            <li>Normalogi deposited 200 ETB</li>
            <li>Game #57 finished – prize 520 ETB</li>
            <li>New user joined: @player123</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
