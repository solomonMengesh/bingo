import React, { useEffect, useState } from 'react';
import api from '../services/api';

const StatusPill = ({ status }) => {
  const map = {
    pending: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] border capitalize ${
        map[status] || 'bg-slate-700/40 text-slate-200 border-slate-600/60'
      }`}
    >
      {status}
    </span>
  );
};

const WithdrawalsPage = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionModal, setActionModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get('/api/withdrawal-requests', { params });
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load withdrawals', err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [statusFilter, dateFrom, dateTo]);

  const handleApprove = async (row) => {
    try {
      setSaving(true);
      await api.patch(`/api/withdrawal-requests/${row._id}`, { status: 'approved' });
      setActionModal(null);
      setRejectReason('');
      fetchList();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (row) => {
    const reason = rejectReason.trim();
    try {
      setSaving(true);
      await api.patch(`/api/withdrawal-requests/${row._id}`, {
        status: 'rejected',
        rejectReason: reason || undefined,
      });
      setActionModal(null);
      setRejectReason('');
      fetchList();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-100">Withdrawal requests</h2>

      <div className="flex flex-wrap gap-3 items-center text-xs">
        <span className="text-slate-400">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <label className="text-slate-400 flex items-center gap-1">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
          />
        </label>
        <label className="text-slate-400 flex items-center gap-1">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
          />
        </label>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Transaction ID</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Bank</th>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-left">Requested</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-slate-500 text-center">
                      No withdrawal requests found.
                    </td>
                  </tr>
                ) : (
                  list.map((w) => (
                    <tr key={w._id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-mono text-slate-300">{w.transactionId}</td>
                      <td className="px-3 py-2">
                        <div>{w.user?.username || w.user?.telegramId || '—'}</div>
                        <div className="text-slate-500">{w.user?.phone}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{w.amount} ETB</td>
                      <td className="px-3 py-2 text-slate-300">{w.bank}</td>
                      <td className="px-3 py-2 text-slate-300">
                        <div>{w.accountNumber}</div>
                        <div className="text-slate-500">{w.accountHolderName}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{formatDate(w.createdAt)}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={w.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {w.status === 'pending' && (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              className="px-2 py-1 rounded-lg bg-emerald-600 text-[11px] hover:bg-emerald-500"
                              onClick={() => handleApprove(w)}
                              disabled={saving}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 rounded-lg bg-rose-600 text-[11px] hover:bg-rose-500"
                              onClick={() => setActionModal({ row: w, action: 'reject' })}
                              disabled={saving}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {w.status !== 'pending' && w.processingTimeMs != null && (
                          <span className="text-slate-500">
                            {w.processingTimeMs >= 60000
                              ? `${Math.floor(w.processingTimeMs / 60000)}m`
                              : `${Math.floor(w.processingTimeMs / 1000)}s`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {actionModal?.action === 'reject' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-sm w-full shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">Reject withdrawal</h3>
            <p className="text-xs text-slate-400 mb-2">
              Optional: add a reason to show the user.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                className="flex-1 px-3 py-2 rounded-lg bg-rose-600 text-sm hover:bg-rose-500 disabled:opacity-50"
                onClick={() => handleReject(actionModal.row)}
                disabled={saving}
              >
                {saving ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-slate-700 text-sm hover:bg-slate-600"
                onClick={() => { setActionModal(null); setRejectReason(''); }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WithdrawalsPage;
