import React, { useEffect, useState } from 'react';
import api from '../services/api';

const StatusPill = ({ status }) => {
  const map = {
    RUNNING: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    SCHEDULED: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    STOPPED: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] border ${
        map[status] || 'bg-slate-700/40 text-slate-200 border-slate-600/60'
      }`}
    >
      {status}
    </span>
  );
};

const formatOpenTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
};

const toDatetimeLocal = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
};

const GamesPage = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameSetTime, setGameSetTime] = useState(null);
  const [setTimeValue, setSetTimeValue] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    stakeEtb: '',
    playerLimit: '',
    platformFeePercent: '',
    scheduledStartAt: '',
  });

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/games');
        setGames(res.data?.games || []);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load games', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  const updateGameStatus = async (gameId, nextStatus) => {
    try {
      const res = await api.patch(`/api/games/${gameId}/status`, {
        status: nextStatus,
      });
      const updated = res.data?.game;
      if (updated) {
        setGames((prev) => prev.map((g) => (g._id === updated._id ? updated : g)));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update game status', err);
      // eslint-disable-next-line no-alert
      alert('Could not update game status. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-100">Games</h2>
        <button
          type="button"
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 text-xs font-semibold hover:bg-emerald-500 flex items-center justify-center"
          onClick={() => setShowCreate(true)}
        >
          Create Game
        </button>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Game ID</th>
              <th className="px-3 py-2 text-left">Stake</th>
              <th className="px-3 py-2 text-left">Opens at</th>
              <th className="px-3 py-2 text-left">Round</th>
              <th className="px-3 py-2 text-left">Phase</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && (
              <tr>
                <td
                  className="px-3 py-4 text-center text-slate-400"
                  colSpan={7}
                >
                  Loading games...
                </td>
              </tr>
            )}
            {!loading &&
              games.map((g) => (
                <tr key={g._id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2">#{g._id.slice(-6)}</td>
                  <td className="px-3 py-2 text-slate-300">{g.stakeEtb} ETB</td>
                  <td className="px-3 py-2 text-slate-400 text-[11px]">
                    {formatOpenTime(g.scheduledStartAt)}
                    {(g.status === 'scheduled' || g.status === 'open') && (
                      <button
                        type="button"
                        className="ml-1 text-emerald-400 hover:underline"
                        onClick={() => {
                          setGameSetTime(g);
                          setSetTimeValue(toDatetimeLocal(g.scheduledStartAt));
                        }}
                      >
                        Set
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{g.currentRoundNumber ?? 1}</td>
                  <td className="px-3 py-2 text-slate-400 text-[10px]">{g.roundStatus ?? '—'}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={g.status?.toUpperCase?.() || 'SCHEDULED'} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 text-[11px] hover:bg-slate-700"
                        onClick={() => setSelectedGame(g)}
                      >
                        View players
                      </button>
                      {g.status === 'scheduled' && (
                        <button
                          type="button"
                          className="min-h-[44px] px-3 py-2 rounded-lg bg-emerald-600 text-[11px] hover:bg-emerald-500"
                          onClick={() => updateGameStatus(g._id, 'running')}
                        >
                          Start Game
                        </button>
                      )}
                      {g.status === 'running' && (
                        <button
                          type="button"
                          className="min-h-[44px] px-3 py-2 rounded-lg bg-rose-600 text-[11px] hover:bg-rose-500"
                          onClick={() => updateGameStatus(g._id, 'stopped')}
                        >
                          Stop Game
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {/* Create game modal (frontend-only) */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-4 text-xs shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-slate-100">Create Bingo game</p>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.stakeEtb || !form.playerLimit || !form.platformFeePercent) {
                  // eslint-disable-next-line no-alert
                  alert('Please fill all fields.');
                  return;
                }
                try {
                  setSaving(true);
                  const payload = {
                    stakeEtb: Number(form.stakeEtb),
                    playerLimit: Number(form.playerLimit),
                    platformFeePercent: Number(form.platformFeePercent),
                  };
                  const startAtStr = form.scheduledStartAt?.trim();
                  if (startAtStr) {
                    const startAt = new Date(startAtStr);
                    if (!Number.isNaN(startAt.getTime())) {
                      payload.scheduledStartAt = startAt.toISOString();
                    }
                  }
                  const res = await api.post('/api/games', payload);
                  const created = res.data?.game;
                  if (created) {
                    setGames((prev) => [created, ...prev]);
                  }
                  setForm({
                    stakeEtb: '',
                    playerLimit: '',
                    platformFeePercent: '',
                    scheduledStartAt: '',
                  });
                  setShowCreate(false);
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error('Failed to create game', err);
                  // eslint-disable-next-line no-alert
                  alert('Failed to create game. Please try again.');
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-400">Stake (ETB)</span>
                  <input
                    type="number"
                    value={form.stakeEtb}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, stakeEtb: e.target.value }))
                    }
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. 10, 20, 50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Player limit</span>
                  <input
                    type="number"
                    value={form.playerLimit}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        playerLimit: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. 75"
                  />
                </label>
              </div>
              <label className="space-y-1 block">
                <span className="text-slate-400">Platform fee %</span>
                <input
                  type="number"
                  value={form.platformFeePercent}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      platformFeePercent: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. 10"
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-slate-400">Opens at (game start time)</span>
                <input
                  type="datetime-local"
                  value={form.scheduledStartAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, scheduledStartAt: e.target.value }))}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500">Optional. When this scheduled game opens. Bot shows &quot;Starts in X minutes&quot;.</span>
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-800 text-[11px] hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-3 py-2.5 rounded-xl bg-emerald-600 text-[11px] font-semibold hover:bg-emerald-500"
                >
                  {saving ? 'Saving…' : 'Save game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set open time modal */}
      {gameSetTime && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-4 text-xs shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-slate-100">Set game open time</p>
              <button
                type="button"
                onClick={() => setGameSetTime(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-400 mb-2">Game #{gameSetTime._id?.slice(-6)} — when the game opens (bot &quot;Starts in X minutes&quot;).</p>
            <input
              type="datetime-local"
              value={setTimeValue}
              onChange={(e) => setSetTimeValue(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setGameSetTime(null); setSetTimeValue(''); }}
                className="flex-1 min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-800 text-[11px] hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const value = setTimeValue?.trim();
                  try {
                    setSaving(true);
                    await api.patch(`/api/games/${gameSetTime._id}`, {
                      scheduledStartAt: value ? new Date(value).toISOString() : null,
                    });
                    setGames((prev) => prev.map((g) => (g._id === gameSetTime._id ? { ...g, scheduledStartAt: value ? new Date(value) : null } : g)));
                    setGameSetTime(null);
                    setSetTimeValue('');
                  } catch (err) {
                    console.error(err);
                    alert(err.response?.data?.message || 'Failed to set time.');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="flex-1 min-h-[44px] px-3 py-2.5 rounded-xl bg-emerald-600 text-[11px] font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View players modal (demo only) */}
      {selectedGame && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-4 text-xs shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-slate-100">
                Players for game #{selectedGame.id}
              </p>
              <button
                type="button"
                onClick={() => setSelectedGame(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 text-sm rounded-xl hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-400 mb-2">
              This is a UI placeholder. Later, fetch real players from your
              backend.
            </p>
            <ul className="space-y-1 text-slate-300 max-h-40 overflow-y-auto">
              <li>@normalogi — Card #57</li>
              <li>@player2 — Card #12</li>
              <li>@demoUser — Card #33</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamesPage;

