import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { setAdminAuth } from './adminAuth';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const u = username.trim();
    if (!u) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/api/admin/login', { username: u, password });
      const data = res.data || {};
      const token = data.token;
      if (token) {
        setAdminAuth(token);
        const from = location.state?.from?.pathname || '/admin';
        navigate(from, { replace: true });
      } else {
        setError('Invalid response from server.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900/95 border border-slate-700/80 p-6 shadow-2xl space-y-5">
        <div className="space-y-1 text-center">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-violet-500 items-center justify-center text-lg font-bold text-white mb-2">
            BG
          </div>
          <h1 className="text-lg font-semibold text-slate-100">Admin Login</h1>
          <p className="text-xs text-slate-400">
            Sign in with your admin username and password.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-username" className="block text-xs font-medium text-slate-300">
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              className="w-full rounded-xl bg-slate-950 border border-slate-600 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl bg-slate-950 border border-slate-600 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-sm font-semibold text-white py-3 hover:from-emerald-500 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
