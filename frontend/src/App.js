import React, { useState, useEffect } from 'react';
import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './services/api';
import MaintenancePage from './components/MaintenancePage';
import Lobby from './pages/Lobby';
import Cartela from './pages/Cartela';
import Game from './pages/Game';
import Wallet from './pages/Wallet';
import Win from './pages/Win';
import AdminLayout from './admin/AdminLayout';
import DashboardPage from './admin/DashboardPage';
import DepositsPage from './admin/DepositsPage';
import UsersPage from './admin/UsersPage';
import GamesPage from './admin/GamesPage';
import LiveBingoPage from './admin/LiveBingoPage';
import WinnersPage from './admin/WinnersPage';
import RevenuePage from './admin/RevenuePage';
import BroadcastPage from './admin/BroadcastPage';
import SettingsPage from './admin/SettingsPage';
import WithdrawalsPage from './admin/WithdrawalsPage';
import PaymentMethodsPage from './admin/PaymentMethodsPage';
import AdminLoginPage from './admin/AdminLoginPage';

import { isAdminAuthed } from './admin/adminAuth';

const RequireAdmin = ({ children }) => {
  const location = useLocation();

  if (!isAdminAuthed()) {
    return (
      <Navigate
        to="/admin-login"
        replace
        state={{ from: location.pathname || '/admin' }}
      />
    );
  }

  return children;
};

const AppShell = () => {
  const { loading, user, authError } = useAuth();
  const location = useLocation();
  const isAdminPath =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/admin-login');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-deepSpace">
        <div className="w-16 h-16 rounded-full border-4 border-bingoPink border-t-bingoGold animate-spin" />
      </div>
    );
  }

  // If we failed to load a valid user for the player app, block and show message.
  // Admin routes have their own auth and should still be reachable in a normal browser.
  if (!user && !isAdminPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-deepSpace text-slate-100 px-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-semibold">Bingo game unavailable</h1>
          <p className="text-xs text-slate-300">
            {authError ||
              'We could not link this game to your Telegram account. Please open the Bingo bot in Telegram and use the Play Now button to launch the game.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-deepSpace text-slate-100 font-outfit">
      <main
        className={`flex-1 flex flex-col w-full max-w-full mx-auto ${isAdminPath ? 'p-0' : 'px-4 pt-4 pb-24'}`}
        style={{ maxWidth: isAdminPath ? undefined : '420px' }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/lobby" replace />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/cartela" element={<Cartela />} />
          <Route path="/game" element={<Game />} />
          <Route path="/win" element={<Win />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/admin-login" element={<AdminLoginPage />} />
          {/* Admin routes (frontend-only dashboard) */}
          <Route
            path="/admin"
            element={(
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            )}
          >
            <Route index element={<DashboardPage />} />
            <Route path="deposits" element={<DepositsPage />} />
            <Route path="payment-methods" element={<PaymentMethodsPage />} />
            <Route path="withdrawals" element={<WithdrawalsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="games" element={<GamesPage />} />
            <Route path="live" element={<LiveBingoPage />} />
            <Route path="winners" element={<WinnersPage />} />
            <Route path="revenue" element={<RevenuePage />} />
            <Route path="broadcast" element={<BroadcastPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route
            path="*"
            element={<Navigate to="/lobby" state={{ from: location }} replace />}
          />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    api.get('/api/settings').then((res) => {
      if (res.data?.maintenanceMode) setMaintenance(true);
    }).catch(() => {});
    const onMaintenance = () => setMaintenance(true);
    window.addEventListener('bingo-maintenance', onMaintenance);
    return () => window.removeEventListener('bingo-maintenance', onMaintenance);
  }, []);

  if (maintenance) return <MaintenancePage />;

  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}

export default App;

