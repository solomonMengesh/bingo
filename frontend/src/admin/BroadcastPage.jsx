import React, { useState } from 'react';
import api from '../services/api';

const BroadcastPage = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const text = [title.trim(), message.trim()].filter(Boolean).join('\n\n');
    if (!text) {
      setError('Enter a title or message.');
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/api/broadcast', {
        title: title.trim() || undefined,
        message: message.trim() || undefined,
      });
      setResult(res.data || {});
      setMessage('');
      setTitle('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send broadcast.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h2 className="text-sm font-semibold text-slate-100">Broadcast Message</h2>
      <p className="text-xs text-slate-400">
        Send an announcement to all users in the Telegram bot. They will receive it as a direct message.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div>
            <label htmlFor="broadcast-title" className="block text-xs font-medium text-slate-400 mb-1.5">
              Title (optional)
            </label>
            <input
              id="broadcast-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tonight: Live Bingo at 9 PM"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0"
            />
          </div>
          <div>
            <label htmlFor="broadcast-message" className="block text-xs font-medium text-slate-400 mb-1.5">
              Message
            </label>
            <textarea
              id="broadcast-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your broadcast message here..."
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0 resize-y"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm text-rose-400">
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-400">
            {result.message || `Sent to ${result.sent ?? 0} user(s).`}
            {result.total != null && (
              <span className="block text-xs text-slate-400 mt-1">
                Total: {result.total} · Sent: {result.sent ?? 0} · Failed: {result.failed ?? 0}
              </span>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? 'Sending…' : 'Send broadcast'}
        </button>
      </form>
    </div>
  );
};

export default BroadcastPage;
