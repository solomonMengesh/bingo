import React, { useState, useEffect } from 'react';
import api from '../services/api';

const SettingsPage = () => {
  const [supportContact, setSupportContact] = useState('');
  const [supportContactSaving, setSupportContactSaving] = useState(false);
  const [supportContactSaved, setSupportContactSaved] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminSaved, setAdminSaved] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/api/settings');
        const data = res.data || {};
        setSupportContact(data.supportContact ?? '@esubingosupport1');
        setAdminUsername(data.adminUsername ?? '');
        setMaintenanceMode(Boolean(data.maintenanceMode));
      } catch (e) {
        console.warn('Failed to load settings', e);
        setSupportContact('@esubingosupport1');
      }
    };
    fetchSettings();
  }, []);

  const setMaintenance = async (value) => {
    setMaintenanceSaving(true);
    try {
      await api.patch('/api/settings', { maintenanceMode: value });
      setMaintenanceMode(value);
    } catch (e) {
      console.error('Failed to update maintenance mode', e);
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const saveAdminCredentials = async () => {
    setAdminSaving(true);
    setAdminSaved(false);
    setSeedResult(null);
    try {
      await api.patch('/api/settings', {
        adminUsername: adminUsername.trim() || undefined,
        adminPassword: adminPassword || undefined,
      });
      setAdminSaved(true);
      setAdminPassword('');
      setTimeout(() => setAdminSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save admin credentials', e);
    } finally {
      setAdminSaving(false);
    }
  };

  const createAdminFromSettings = async () => {
    setSeedResult(null);
    try {
      const res = await api.post('/api/admin/seed-from-settings');
      setSeedResult(res.data?.message || 'Admin created.');
    } catch (e) {
      setSeedResult(e.response?.data?.message || 'Failed. Save username and password above first, or an admin may already exist.');
    }
  };

  const saveSupportContact = async () => {
    setSupportContactSaving(true);
    setSupportContactSaved(false);
    try {
      await api.patch('/api/settings', { supportContact: supportContact.trim() || '@esubingosupport1' });
      setSupportContactSaved(true);
      setTimeout(() => setSupportContactSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save support contact', e);
    } finally {
      setSupportContactSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h2 className="text-sm font-semibold text-slate-100">Settings</h2>

      {/* Maintenance mode */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 md:p-6 space-y-4 min-w-0">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Maintenance mode</h3>
          <p className="text-xs text-slate-400 mt-1">
            When on, players see an &quot;Under maintenance&quot; message and most API calls are blocked. Admin login and this settings page keep working so you can turn it off.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMaintenance(!maintenanceMode)}
            disabled={maintenanceSaving}
            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
              maintenanceMode ? 'bg-amber-500' : 'bg-slate-700'
            }`}
            role="switch"
            aria-checked={maintenanceMode}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition ${
                maintenanceMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-slate-200">
            {maintenanceMode ? 'On' : 'Off'}
          </span>
          {maintenanceSaving && <span className="text-xs text-slate-400">Saving…</span>}
        </div>
      </div>

      {/* Admin login — desktop: single card with clear rows, no overlap */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 md:p-6 space-y-4 min-w-0">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Admin login (store in DB)</h3>
          <p className="text-xs text-slate-400 mt-1">
            Save admin username and password to the database. On next server start with no admins, the first admin is created from these. Or click &quot;Create admin now&quot; after saving to create without restart.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="settings-admin-username" className="text-xs font-medium text-slate-400 block">
              Username
            </label>
            <input
              id="settings-admin-username"
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="admin"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="settings-admin-password" className="text-xs font-medium text-slate-400 block">
              Password
            </label>
            <input
              id="settings-admin-password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={saveAdminCredentials}
            disabled={adminSaving}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          >
            {adminSaving ? 'Saving…' : 'Save to DB'}
          </button>
          <button
            type="button"
            onClick={createAdminFromSettings}
            className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
          >
            Create admin now
          </button>
          {adminSaved && <span className="text-xs text-emerald-400">Saved</span>}
          {seedResult && <span className="text-xs text-slate-300 max-w-md">{seedResult}</span>}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-200">Contact / Support</h3>
        <p className="text-[11px] text-slate-400">
          Telegram handle shown to users when deposit verification fails (e.g. @esubingosupport1).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={supportContact}
            onChange={(e) => setSupportContact(e.target.value)}
            placeholder="@esubingosupport1"
            className="flex-1 min-w-[180px] rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={saveSupportContact}
            disabled={supportContactSaving}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {supportContactSaving ? 'Saving…' : 'Save'}
          </button>
          {supportContactSaved && (
            <span className="text-[11px] text-emerald-400">Saved</span>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-200">
          Game settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-slate-400">Entry fee percentage</span>
            <input
              type="number"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              defaultValue={90}
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">House commission percentage</span>
            <input
              type="number"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              defaultValue={10}
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Minimum deposit (ETB)</span>
            <input
              type="number"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              defaultValue={50}
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Max players per game</span>
            <input
              type="number"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              defaultValue={75}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-200">Telebirr</h3>
        <p className="text-[11px] text-slate-400">
          Example deposit account shown to players in the bot.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <label className="space-y-1">
            <span className="text-slate-400">Provider</span>
            <input
              type="text"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              defaultValue="Telebirr"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Account number</span>
            <input
              type="text"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              defaultValue="0988119439"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Account name</span>
            <input
              type="text"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              defaultValue="Leul"
            />
          </label>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Support contact is saved to the backend and used in the bot when deposit
        verification fails. Other controls above are visual only for now.
      </p>
    </div>
  );
};

export default SettingsPage;

