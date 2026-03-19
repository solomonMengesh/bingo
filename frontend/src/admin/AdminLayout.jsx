import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { clearAdminAuth } from './adminAuth';

const menuItems = [
  { to: '/admin', label: 'Dashboard', exact: true },
  { to: '/admin/deposits', label: 'Deposits' },
  { to: '/admin/payment-methods', label: 'Payment methods' },
  { to: '/admin/withdrawals', label: 'Withdrawals' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/games', label: 'Games' },
  { to: '/admin/live', label: 'Live Bingo' },
  { to: '/admin/winners', label: 'Winners' },
  { to: '/admin/revenue', label: 'Revenue' },
  { to: '/admin/broadcast', label: 'Broadcast Message' },
  { to: '/admin/settings', label: 'Settings' },
];

const bottomNavItems = [
  { to: '/admin', label: 'Dashboard', exact: true, icon: '📊' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/games', label: 'Games', icon: '🎮' },
  { to: '/admin/revenue', label: 'Revenue', icon: '💰' },
  { to: '/admin/deposits', label: 'Deposits', icon: '📥' },
];

const hamburgerItems = [
  { to: '/admin/payment-methods', label: 'Payment methods' },
  { to: '/admin/withdrawals', label: 'Withdrawals' },
  { to: '/admin/live', label: 'Live Bingo' },
  { to: '/admin/winners', label: 'Winners' },
  { to: '/admin/broadcast', label: 'Broadcast Message' },
  { to: '/admin/settings', label: 'Settings' },
];

const navLinkClass = ({ isActive }) =>
  `group flex items-center px-3 py-2 rounded-xl transition-all duration-150 min-h-[44px] ${
    isActive
      ? 'bg-gradient-to-r from-emerald-500/80 to-violet-500/80 text-white shadow-[0_0_25px_rgba(16,185,129,0.65)] scale-[1.02]'
      : 'text-slate-300/80 hover:bg-slate-800/80 hover:text-slate-50'
  }`;

const AdminLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/admin/me').then((res) => {
      setAdminUser(res.data?.admin ?? null);
    }).catch(() => setAdminUser(null));
  }, []);

  const handleLogout = () => {
    clearAdminAuth();
    navigate('/admin-login', { replace: true });
  };

  return (
    <div className="min-h-screen flex justify-center bg-[#020617] text-slate-100">
      <div className="w-full flex min-h-screen max-w-[1920px]">
      {/* Sidebar — hidden only on small screens (show from 640px = sm) */}
      <aside className="hidden sm:flex w-56 lg:w-64 flex-shrink-0 flex-col border-r border-white/10 backdrop-blur-2xl bg-slate-900/40 shadow-[0_0_60px_rgba(15,23,42,0.9)]">
        <div className="px-4 pt-4 pb-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-400 to-violet-500 flex items-center justify-center text-xs font-bold shadow-lg">
            BG
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bingo</p>
            <p className="text-sm font-semibold text-slate-50">Admin Console</p>
          </div>
        </div>
        <nav className="flex-1 px-2 pb-4 space-y-1 text-xs overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={navLinkClass}
            >
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content — max-width on desktop for readability */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full xl:max-w-[1600px]">
        <header className="h-14 shrink-0 border-b border-slate-800/80 flex items-center justify-between px-4 sm:px-6 bg-slate-950/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="sm:hidden flex items-center justify-center w-11 h-11 rounded-xl bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 min-h-[44px] min-w-[44px] flex-shrink-0"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold text-slate-100 truncate">
              Telegram Bingo Admin
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 flex-shrink-0">
            {adminUser?.username && (
              <span className="hidden sm:inline px-2 py-1 rounded-lg bg-slate-800/70 border border-slate-600/70 text-[10px] uppercase tracking-wide truncate max-w-[120px]">
                {adminUser.username}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="px-2 py-1.5 rounded-lg bg-slate-800/70 border border-slate-600/70 text-[10px] font-medium text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 pb-20 sm:pb-6">
          <div className="w-full max-w-full min-w-0 mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Bottom Navigation — visible only on small screens (hide from 640px = sm) */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-xl flex items-center justify-around px-2 safe-area-pb">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-2 rounded-xl transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
              <span className="text-[10px] font-medium truncate max-w-full">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Hamburger overlay — slide-in from right with Framer Motion */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 sm:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] bg-slate-900 border-l border-slate-800 shadow-2xl sm:hidden flex flex-col"
            >
              <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-200">More</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 min-h-[44px] min-w-[44px]"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 px-2 py-4 space-y-1 text-xs overflow-y-auto">
                {hamburgerItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={navLinkClass}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="flex-1">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminLayout;
