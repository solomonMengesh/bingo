import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useGameState(telegramId, gameId = null) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!telegramId && !gameId) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = { telegramId: telegramId || undefined, gameId: gameId || undefined };
      const res = await api.get('/api/game/state', { params });
      setState(res.data?.state ?? res.data?.game ?? null);
    } catch (err) {
      console.warn('Failed to fetch game state', err);
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [telegramId, gameId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { state, loading, refetch };
}
