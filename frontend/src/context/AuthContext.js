import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { getTelegramInitData, initTelegramWebApp } from '../utils/telegram';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      initTelegramWebApp();
      const tgData = getTelegramInitData();

      // No Telegram context (running in normal browser)
      // Do NOT auto-login with a demo user: force real Telegram launch/registration.
      if (!tgData?.user) {
        setUser(null);
        setBalance(0);
        setAuthError(
          'Please open this Bingo game from the Telegram bot so we can link it to your account.'
        );
        setLoading(false);
        return;
      }

      try {
        const telegramId = String(tgData.user.id);

        // Persist telegramId so refreshes keep working
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('bingo_telegram_id', telegramId);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to persist telegramId', e);
          }
        }

        // Look up existing user by telegramId and get balance
        const meRes = await api.get('/api/auth/me', {
          params: { telegramId },
          validateStatus: (s) => s === 200 || s === 404,
        });

        if (meRes.status === 200 && meRes.data?.user) {
          const backendUser = meRes.data.user;
          setUser({
            id: telegramId,
            first_name: backendUser.username || tgData.user.first_name,
          });
          setBalance(backendUser.balance ?? 0);
        } else {
          // If not found, attempt to register automatically using Telegram data.
          const registerRes = await api.post(
            '/api/auth/register',
            {
              telegramId,
              username: tgData.user.username || tgData.user.first_name,
            },
            {
              validateStatus: (s) => s === 200 || s === 201,
            }
          );

          if (registerRes.data?.user) {
            const backendUser = registerRes.data.user;
            setUser({
              id: telegramId,
              first_name: backendUser.username || tgData.user.first_name,
            });
            setBalance(backendUser.balance ?? 0);
          } else {
            setUser(null);
            setBalance(0);
            setAuthError(
              'You are not registered yet. Open the Telegram Bingo bot, send /start to register, then tap Play Now again.'
            );
          }
        }
      } catch (e) {
        const msg = e.response?.data?.message || e.message || String(e);
        const status = e.response?.status;
        // eslint-disable-next-line no-console
        console.warn('Failed to load user from backend', { status, message: msg, error: e });
        setUser(null);
        setBalance(0);
        setAuthError(
          status === 500
            ? 'Server error. Please try again later.'
            : e.code === 'ERR_NETWORK' || e.message?.includes('Network')
            ? 'Cannot reach the server. Check your connection and try again from Telegram.'
            : 'Unable to load your account from the server. Please try again from Telegram.'
        );
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const value = {
    user,
    token,
    balance,
    setBalance,
    loading,
    authError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

