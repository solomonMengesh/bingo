const getTelegram = () => {
  if (typeof window === 'undefined') return null;
  return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
};

export const initTelegramWebApp = () => {
  const tg = getTelegram();
  if (!tg) return null;

  try {
    tg.ready();
  } catch (e) {
    console.warn('Telegram WebApp ready() failed or not available', e);
  }

  return tg;
};

export const getTelegramUser = () => {
  const tg = getTelegram();
  if (!tg) return null;
  return tg.initDataUnsafe?.user || null;
};

export const getTelegramInitData = () => {
  const tg = getTelegram();
  if (tg) {
    return {
      initData: tg.initData,
      user: tg.initDataUnsafe?.user || null,
    };
  }

  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const telegramIdFromUrl = params.get('telegramId');
      const storedId = window.localStorage.getItem('bingo_telegram_id');
      const effectiveId = telegramIdFromUrl || storedId;

      if (effectiveId) {
        return {
          initData: null,
          user: { id: effectiveId },
        };
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to resolve telegramId from URL/localStorage', e);
    }
  }

  return null;
};

