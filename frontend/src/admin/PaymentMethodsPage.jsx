import React, { useEffect, useState } from 'react';
import api from '../services/api';

const TYPE_LABELS = { mobile_money: 'Mobile money', bank_transfer: 'Bank transfer' };
const INIT_FORM = {
  name: '',
  type: 'mobile_money',
  accountName: '',
  accountNumber: '',
  instructions: '',
  minDeposit: '',
  maxDeposit: '',
  isEnabled: true,
};

const PaymentMethodsPage = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/payment-methods');
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load payment methods', err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(INIT_FORM);
    setShowForm(true);
  };

  const openEdit = (pm) => {
    setEditing(pm);
    setForm({
      name: pm.name || '',
      type: pm.type || 'mobile_money',
      accountName: pm.accountName || '',
      accountNumber: pm.accountNumber || '',
      instructions: pm.instructions || '',
      minDeposit: pm.minDeposit ?? '',
      maxDeposit: pm.maxDeposit ?? '',
      isEnabled: pm.isEnabled !== false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(INIT_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      type: form.type,
      accountName: form.accountName.trim(),
      accountNumber: form.accountNumber.trim(),
      instructions: (form.instructions || '').trim(),
      minDeposit: Number(form.minDeposit) || 0,
      maxDeposit: Number(form.maxDeposit) || 0,
      isEnabled: form.isEnabled,
    };
    if (!payload.name || !payload.accountName || !payload.accountNumber) {
      alert('Name, account name and account number are required.');
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await api.patch(`/api/payment-methods/${editing._id}`, payload);
      } else {
        await api.post('/api/payment-methods', payload);
      }
      closeForm();
      fetchList();
    } catch (err) {
      console.error('Save failed', err);
      alert(err.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (pm) => {
    try {
      await api.patch(`/api/payment-methods/${pm._id}`, { isEnabled: !pm.isEnabled });
      fetchList();
    } catch (err) {
      console.error('Toggle failed', err);
      alert('Failed to update. Please try again.');
    }
  };

  const handleDelete = async (pm) => {
    try {
      await api.delete(`/api/payment-methods/${pm._id}`);
      setDeleteConfirm(null);
      fetchList();
    } catch (err) {
      console.error('Delete failed', err);
      alert(err.response?.data?.message || 'Failed to delete.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Payment methods</h2>
          <p className="text-[11px] text-slate-500">
            Configure deposit options. Only enabled methods appear in the bot /deposit menu.
          </p>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-semibold hover:bg-emerald-500"
          onClick={openAdd}
        >
          Add payment method
        </button>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-right">Min / Max (ETB)</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-400" colSpan={6}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && list.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                  No payment methods yet. Add one to show deposit options in the bot.
                </td>
              </tr>
            )}
            {!loading &&
              list.map((pm) => (
                <tr key={pm._id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 font-medium text-slate-100">{pm.name}</td>
                  <td className="px-3 py-2 text-slate-300">{TYPE_LABELS[pm.type] || pm.type}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {pm.accountName} · {pm.accountNumber}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {pm.minDeposit} / {pm.maxDeposit}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] border ${
                        pm.isEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-600/40 text-slate-400 border-slate-500/40'
                      }`}
                    >
                      {pm.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] hover:bg-slate-700"
                        onClick={() => handleToggleEnabled(pm)}
                      >
                        {pm.isEnabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] hover:bg-slate-700"
                        onClick={() => openEdit(pm)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg bg-rose-600/80 text-[11px] hover:bg-rose-600"
                        onClick={() => setDeleteConfirm(pm)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-xl">
            <div className="px-4 py-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100">
                {editing ? 'Edit payment method' : 'Add payment method'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Telebirr, CBE Bank"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Account name</label>
                <input
                  type="text"
                  value={form.accountName}
                  onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                  placeholder="e.g. Leul"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Account number</label>
                <input
                  type="text"
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  placeholder="e.g. 0980387174"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Instructions (optional)</label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="Extra instructions for the user"
                  rows={2}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Min deposit (ETB)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.minDeposit}
                    onChange={(e) => setForm((f) => ({ ...f, minDeposit: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Max deposit (ETB)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.maxDeposit}
                    onChange={(e) => setForm((f) => ({ ...f, maxDeposit: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="form-enabled"
                  checked={form.isEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
                  className="rounded border-slate-600 bg-slate-800 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="form-enabled" className="text-[11px] text-slate-300">
                  Enabled (show in deposit menu)
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-4">
            <p className="text-sm text-slate-200 mb-4">
              Delete payment method &quot;{deleteConfirm.name}&quot;? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-3 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodsPage;
