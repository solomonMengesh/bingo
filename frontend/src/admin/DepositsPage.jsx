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

const DepositsPage = () => {
  const [deposits, setDeposits] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [approveModal, setApproveModal] = useState(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [receiverSms, setReceiverSms] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const fetchPaymentMethods = async () => {
    try {
      const res = await api.get('/api/payment-methods');
      setPaymentMethods(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPaymentMethods([]);
    }
  };

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (paymentMethodFilter) params.paymentMethodId = paymentMethodFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get('/api/deposit-requests', { params });
      setDeposits(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load deposits', err);
      setDeposits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    fetchDeposits();
  }, [statusFilter, paymentMethodFilter, dateFrom, dateTo]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return deposits;
    return deposits.filter(
      (d) =>
        (d.message && d.message.toLowerCase().includes(term)) ||
        (d.transactionId && d.transactionId.toLowerCase().includes(term)) ||
        (d.user?.telegramId && d.user.telegramId.toLowerCase().includes(term)) ||
        (d.user?.username && d.user.username.toLowerCase().includes(term)) ||
        (d.paymentMethod?.name && d.paymentMethod.name.toLowerCase().includes(term))
    );
  }, [deposits, search]);

  const handleApprove = async () => {
    if (!approveModal) return;
    const amount = approveAmount.trim() ? Number(approveAmount) : approveModal.amount;
    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      alert('Enter a valid amount (ETB).');
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/api/deposit-requests/${approveModal._id}`, {
        status: 'approved',
        amount,
      });
      setApproveModal(null);
      setApproveAmount('');
      fetchDeposits();
    } catch (err) {
      console.error('Approve failed', err);
      alert(err.response?.data?.message || 'Failed to approve.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (d) => {
    if (!window.confirm('Reject this deposit request?')) return;
    try {
      await api.patch(`/api/deposit-requests/${d._id}`, { status: 'rejected' });
      fetchDeposits();
    } catch (err) {
      console.error('Reject failed', err);
      alert('Failed to reject.');
    }
  };

  const handleVerifyWithReceiverSms = async () => {
    const msg = receiverSms.trim();
    if (!msg) {
      alert('Paste the receiver SMS (from your phone) to verify.');
      return;
    }
    try {
      setVerifying(true);
      setVerifyResult(null);
      const res = await api.post('/api/deposit-requests/verify', { sms: msg });
      setVerifyResult(res.data?.message || 'Deposit approved automatically.');
      setReceiverSms('');
      fetchDeposits();
    } catch (err) {
      const data = err.response?.data;
      setVerifyResult(data?.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString();
  };

  const openApproveModal = (d) => {
    setApproveModal(d);
    setApproveAmount(d.amount != null ? String(d.amount) : '');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Deposits</h2>
        <p className="text-[11px] text-slate-500">
          Auto-verify by pasting receiver SMS (match transaction ID + amount). Or approve/reject manually.
        </p>
      </div>

      {/* Verify with receiver SMS */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <h3 className="text-xs font-semibold text-slate-200 mb-2">Verify with receiver SMS</h3>
        <p className="text-[11px] text-slate-500 mb-2">
          Paste the SMS from your (receiver) phone. If transaction ID and amount match a pending deposit, it will be approved automatically.
        </p>
        <textarea
          value={receiverSms}
          onChange={(e) => setReceiverSms(e.target.value)}
          placeholder="Paste receiver SMS here..."
          rows={3}
          className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none mb-2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyWithReceiverSms}
            disabled={verifying || !receiverSms.trim()}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify & approve'}
          </button>
          {verifyResult && (
            <span className="text-[11px] text-slate-300">{verifyResult}</span>
          )}
        </div>
      </div>

      {/* Filters — search full width on mobile */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          className="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All payment methods</option>
          {paymentMethods.map((pm) => (
            <option key={pm._id} value={pm._id}>{pm.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search message, Tx ID, user..."
          className="w-full md:w-auto md:min-w-[180px] min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Mobile: stacked cards with Amount + Status at top */}
      <div className="md:hidden space-y-3">
        {loading && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-center text-slate-400 text-xs">
            Loading...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-center text-slate-500 text-xs">
            No deposit requests match the filters.
          </div>
        )}
        {!loading && filtered.map((d) => (
          <div
            key={d._id}
            className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden"
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <span className="font-mono text-base font-semibold text-emerald-300">
                {d.amount != null ? `${d.amount} ETB` : '—'}
              </span>
              <StatusPill status={d.status} />
            </div>
            <div className="px-4 py-2 space-y-1 text-xs">
              <p className="text-slate-200">
                {d.user?.username ? `@${d.user.username}` : d.user?.telegramId || '—'}
              </p>
              <p className="text-slate-400">{d.paymentMethod?.name || '—'}</p>
              <p className="text-slate-500">{formatDate(d.createdAt)}</p>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-2 border-t border-slate-800">
              <button
                type="button"
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 text-[11px] hover:bg-slate-700"
                onClick={() => alert(`Full message:\n\n${d.message}`)}
              >
                View
              </button>
              {d.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 text-[11px] hover:bg-emerald-500"
                    onClick={() => openApproveModal(d)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 text-[11px] hover:bg-rose-500"
                    onClick={() => handleReject(d)}
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table with horizontal scroll */}
      <div className="hidden md:block rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">User / Telegram</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Tx ID</th>
              <th className="px-3 py-2 text-left">Message</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-400" colSpan={8}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={8}>
                  No deposit requests match the filters.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((d) => (
                <tr key={d._id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2">
                    <div>{d.user?.username ? `@${d.user.username}` : d.user?.telegramId || '—'}</div>
                    <div className="text-[10px] text-slate-500">{d.user?.phone || d.user?.telegramId}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{d.paymentMethod?.name || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {d.amount != null ? `${d.amount} ETB` : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-[10px]">
                    {d.transactionId || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate" title={d.message}>
                    {d.message}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={d.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-400">{formatDate(d.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 text-[11px] hover:bg-slate-700"
                        onClick={() => alert(`Full message:\n\n${d.message}`)}
                      >
                        View
                      </button>
                      {d.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="min-h-[44px] px-3 py-2 rounded-lg bg-emerald-600 text-[11px] hover:bg-emerald-500"
                            onClick={() => openApproveModal(d)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="min-h-[44px] px-3 py-2 rounded-lg bg-rose-600 text-[11px] hover:bg-rose-500"
                            onClick={() => handleReject(d)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-4">
            <p className="text-sm text-slate-200 mb-2">Approve deposit request</p>
            <p className="text-[11px] text-slate-400 mb-3">
              Amount to credit (ETB). Pre-filled if parsed from customer SMS.
            </p>
            <input
              type="number"
              min={1}
              placeholder="Amount in ETB"
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
              className="w-full min-h-[44px] rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApproveModal(null) || setApproveAmount('')}
                className="flex-1 min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={saving}
                className="flex-1 min-h-[44px] px-3 py-2.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepositsPage;
