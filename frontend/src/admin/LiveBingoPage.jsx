import React from 'react';

const LiveBingoPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Live Bingo</h2>
        <select className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option>Game #57 (demo)</option>
        </select>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-200 mb-1">
            Called numbers
          </p>
          <div className="flex flex-wrap gap-1 text-[10px]">
            {[13, 24, 45, 53, 71, 8, 19, 35].map((n) => (
              <span
                key={n}
                className="h-6 w-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center"
              >
                {n}
              </span>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-[11px] text-slate-400 mb-1">Current number</p>
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500 text-white font-bold text-sm shadow-lg">
              71
            </div>
          </div>

          <div className="mt-4 flex gap-2 text-[11px]">
            <button
              type="button"
              className="flex-1 px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold"
            >
              Call next number
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl bg-amber-500/90 hover:bg-amber-400 font-semibold text-slate-900"
            >
              Pause
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold"
            >
              End
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-200">
              Players in game
            </p>
            <span className="text-[11px] text-slate-400">Demo layout</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3 text-[11px]">
            <div className="rounded-xl border border-slate-800 p-3">
              <p className="font-semibold text-slate-200 mb-1">
                Normalogi (@normalogi)
              </p>
              <p className="text-slate-400 mb-2">Card #57</p>
              <div className="h-40 rounded-xl bg-slate-800/60 border border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                Player card preview
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 p-3">
              <p className="font-semibold text-slate-200 mb-1">Player2</p>
              <p className="text-slate-400 mb-2">Card #12</p>
              <div className="h-40 rounded-xl bg-slate-800/60 border border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                Player card preview
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBingoPage;

