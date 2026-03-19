import React from 'react';

const mockWinners = [
  {
    id: 1,
    gameId: 57,
    username: '@normalogi',
    prize: 520,
    pattern: 'Diagonal',
    date: '2026-03-12 10:40',
  },
];

const WinnersPage = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-100">Winners</h2>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Game ID</th>
              <th className="px-3 py-2 text-left">Winner</th>
              <th className="px-3 py-2 text-right">Prize</th>
              <th className="px-3 py-2 text-left">Pattern</th>
              <th className="px-3 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {mockWinners.map((w) => (
              <tr key={w.id} className="hover:bg-slate-800/40">
                <td className="px-3 py-2">#{w.gameId}</td>
                <td className="px-3 py-2 text-slate-300">{w.username}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {w.prize} ETB
                </td>
                <td className="px-3 py-2 text-slate-300">{w.pattern}</td>
                <td className="px-3 py-2 text-slate-400">{w.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WinnersPage;

