import React, { useMemo, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const StatusPill = ({ status }) => {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border uppercase tracking-wide ${
        isActive
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/60 animate-pulse'
          : 'bg-rose-500/15 text-rose-300 border-rose-400/60'
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isActive ? 'bg-emerald-300' : 'bg-rose-300'
        }`}
      />
      {status.toLowerCase()}
    </span>
  );
};

const getAvatarProps = (username) => {
  const name = username || '';
  const clean = name.replace(/^@/, '');
  const initials = clean
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'U';

  let hash = 0;
  for (let i = 0; i < clean.length; i += 1) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 360;
  }
  const h1 = hash;
  const h2 = (hash + 60) % 360;
  const style = {
    background: `linear-gradient(135deg, hsl(${h1}, 85%, 55%), hsl(${h2}, 80%, 45%))`,
  };
  return { initials, style };
};

const TOUCH_MIN = 'min-h-[44px]';
const fmt = (n) => (Number(n) != null && !Number.isNaN(Number(n)) ? Number(n).toFixed(2) : '0.00');

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [search, setSearch] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/users');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to fetch users', e);
      setError(e.response?.data?.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openModal = (type, user) => {
    setActiveUser(user);
    setActiveModal(type);
    setAdjustAmount('');
    setAdjustReason('');
    if (type === 'history') {
      setHistoryList([]);
      setHistoryLoading(true);
      api.get(`/api/users/${user.id}/history`).then((res) => {
        setHistoryList(Array.isArray(res.data) ? res.data : []);
      }).catch(() => setHistoryList([])).finally(() => setHistoryLoading(false));
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setActiveUser(null);
    setHistoryList([]);
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const tId = String(u.telegramId || '').toLowerCase();
      const un = String(u.username || '').toLowerCase();
      const ph = String(u.phone || '').toLowerCase();
      return tId.includes(term) || un.includes(term) || ph.includes(term);
    });
  }, [users, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Users</h2>
          <p className="text-[11px] text-slate-400">
            Manage players and their balances in a sleek, gaming-style view.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search by username, phone, or Telegram ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full sm:w-auto sm:min-w-[200px] rounded-xl bg-slate-900/80 border border-slate-700/80 px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 shadow-[0_0_0_1px_rgba(15,23,42,0.6)] ${TOUCH_MIN}`}
        />
      </div>

      {error && (
        <div className="rounded-xl bg-rose-900/30 border border-rose-700/50 px-4 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-center py-8 text-slate-400 text-sm">Loading users...</div>
      )}
      {!loading && filteredUsers.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">No users found.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {!loading && filteredUsers.map((u) => {
          const { initials, style } = getAvatarProps(u.username);
          return (
            <div
              key={u.id}
              className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-sm shadow-[0_18px_45px_rgba(15,23,42,0.9)]"
            >
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_top_left,#22c55e,transparent_55%),radial-gradient(circle_at_bottom_right,#0ea5e9,transparent_55%)]" />
              {/* Mobile: Balance + Status at top */}
              <div className="relative px-4 py-3 border-b border-slate-800/60 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-[10px] text-slate-400 mb-0.5">Balance</span>
                  <span className="font-mono text-base font-semibold text-emerald-300">
                    {fmt(u.balance)} ETB
                  </span>
                </div>
                <StatusPill status={u.status} />
              </div>
              <div className="relative px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-md border border-white/10 shrink-0"
                    style={style}
                  >
                    {initials}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-slate-400">User</span>
                    <span className="text-sm font-semibold text-slate-50 truncate">
                      {u.username || '@unknown'}
                    </span>
                    {/* Telegram ID and Joined: hidden on mobile, visible md+ */}
                    <span className="text-[11px] text-slate-400 hidden md:inline">
                      {u.phone} · TG: {u.telegramId}
                    </span>
                  </div>
                </div>
                <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-slate-500">Joined {u.registeredAt}</span>
                </div>
              </div>
              <div className="relative border-t border-slate-800/80 px-4 py-2.5 bg-slate-950/40">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="hidden md:block">
                    <span className="block text-[10px] text-slate-400 mb-0.5">Balance</span>
                    <span className="font-mono text-xs text-emerald-300">{fmt(u.balance)} ETB</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-0.5">Deposits</span>
                    <span className="font-mono text-xs text-sky-300">{fmt(u.totalDeposits)} ETB</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-0.5">Withdrawals</span>
                    <span className="font-mono text-xs text-rose-300">{fmt(u.totalWithdrawals)} ETB</span>
                  </div>
                </div>
              </div>
              <div className="relative border-t border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-slate-950/60">
                <span className="text-[10px] text-slate-500">ID #{u.id?.slice(-6) || u.id}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`px-3 py-2.5 rounded-xl bg-slate-800/80 text-[11px] text-slate-100 hover:bg-slate-700/90 ${TOUCH_MIN}`}
                    onClick={() => openModal('profile', u)}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2.5 rounded-xl bg-emerald-600 text-[11px] text-white hover:bg-emerald-500 ${TOUCH_MIN}`}
                    onClick={() => openModal('adjust', u)}
                  >
                    Adjust
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2.5 rounded-xl bg-slate-700 text-[11px] text-slate-100 hover:bg-slate-600 ${TOUCH_MIN}`}
                    onClick={() => openModal('history', u)}
                  >
                    History
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2.5 rounded-xl bg-rose-600 text-[11px] text-white hover:bg-rose-500 ${TOUCH_MIN}`}
                    onClick={async () => {
                      const next = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
                      try {
                        await api.patch(`/api/users/${u.id}`, { status: next });
                        fetchUsers();
                      } catch (e) {
                        console.error(e);
                        alert(e.response?.data?.message || 'Failed to update status');
                      }
                    }}
                  >
                    {u.status === 'ACTIVE' ? 'Block' : 'Unblock'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeUser && activeModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-4 text-xs shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-slate-100 capitalize">
                {activeModal === 'profile' && 'User profile'}
                {activeModal === 'adjust' && 'Adjust balance'}
                {activeModal === 'history' && 'Transaction history'}
              </p>
              <button
                type="button"
                onClick={closeModal}
                className={`text-slate-400 hover:text-slate-200 text-sm ${TOUCH_MIN} min-w-[44px] flex items-center justify-center`}
              >
                ✕
              </button>
            </div>

            {activeModal === 'profile' && (
              <div className="space-y-1 text-slate-300">
                <p><span className="text-slate-400">User ID:</span> {activeUser.id}</p>
                <p><span className="text-slate-400">Telegram ID:</span> {activeUser.telegramId}</p>
                <p><span className="text-slate-400">Username:</span> {activeUser.username || '—'}</p>
                <p><span className="text-slate-400">Phone:</span> {activeUser.phone || '—'}</p>
                <p><span className="text-slate-400">Balance:</span> {fmt(activeUser.balance)} ETB</p>
                <p><span className="text-slate-400">Registered:</span> {activeUser.registeredAt || '—'}</p>
              </div>
            )}

            {activeModal === 'adjust' && (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const amount = parseFloat(adjustAmount);
                  if (Number.isNaN(amount) || amount === 0) {
                    alert('Enter a valid amount (+ or - ETB).');
                    return;
                  }
                  setAdjustSaving(true);
                  try {
                    await api.patch(`/api/users/${activeUser.id}`, {
                      adjustment: amount,
                      reason: adjustReason.trim() || undefined,
                    });
                    fetchUsers();
                    closeModal();
                  } catch (err) {
                    alert(err.response?.data?.message || 'Failed to adjust balance.');
                  } finally {
                    setAdjustSaving(false);
                  }
                }}
              >
                <div className="text-slate-300 mb-1">
                  Adjust balance for <span className="font-semibold">{activeUser.username}</span>
                </div>
                <label className="block space-y-1">
                  <span className="text-slate-400">Amount (+/- ETB)</span>
                  <input
                    type="number"
                    step="any"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className={`w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${TOUCH_MIN}`}
                    placeholder="e.g. 100 or -50"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400">Reason</span>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className={`w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${TOUCH_MIN}`}
                    placeholder="Manual correction, bonus, refund..."
                  />
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={adjustSaving}
                    className={`px-3 py-2.5 rounded-xl bg-slate-800 text-[11px] hover:bg-slate-700 ${TOUCH_MIN}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjustSaving}
                    className={`px-3 py-2.5 rounded-xl bg-emerald-600 text-[11px] font-semibold hover:bg-emerald-500 ${TOUCH_MIN} disabled:opacity-50`}
                  >
                    {adjustSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}

            {activeModal === 'history' && (
              <div className="space-y-2 text-slate-300">
                <p className="text-slate-400 mb-1">
                  Recent transactions for <span className="font-semibold">{activeUser.username}</span>
                </p>
                {historyLoading ? (
                  <p className="text-slate-500 text-[11px]">Loading…</p>
                ) : historyList.length === 0 ? (
                  <p className="text-slate-500 text-[11px]">No transactions yet.</p>
                ) : (
                  <ul className="space-y-1 max-h-40 overflow-y-auto text-[11px]">
                    {historyList.map((h, i) => (
                      <li key={i}>
                        {new Date(h.date).toLocaleString()} — {h.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
