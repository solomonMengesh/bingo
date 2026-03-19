import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LobbyHeader from '../components/LobbyHeader';
import GameRoomCard from '../components/GameRoomCard';
import { useAuth } from '../context/AuthContext';

function formatCountdown(msRemaining) {
  if (msRemaining <= 0 || msRemaining < 60000) return 'Starts soon';
  const totalMins = Math.floor(msRemaining / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} min`);
  return parts.join(' ');
}

const getStartsInText = (game) => {
  const startAt = game.scheduledStartAt ? new Date(game.scheduledStartAt).getTime() : null;
  if (startAt && startAt > Date.now()) {
    const text = formatCountdown(startAt - Date.now());
    return text === 'Starts soon' ? text : `Discount time — ${text}`;
  }
  if (startAt) return 'Starts soon';
  const created = game.createdAt ? new Date(game.createdAt).getTime() : Date.now();
  const assumedMins = 15;
  const msRemaining = Math.max(0, assumedMins * 60000 - (Date.now() - created));
  const text = formatCountdown(msRemaining);
  return text === 'Starts soon' ? text : `Discount time — ${text}`;
};

const Lobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [runningGames, setRunningGames] = useState([]);
  const [scheduledGames, setScheduledGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWelcomeInfo, setShowWelcomeInfo] = useState(false);

  useEffect(() => {
    try {
      const key = 'bingo_welcome_info_v1';
      const seen = localStorage.getItem(key);
      setShowWelcomeInfo(!seen);
    } catch {
      // If localStorage is not available, don't block the UI.
      setShowWelcomeInfo(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [runningRes, scheduledRes] = await Promise.all([
          api.get('/api/games', { params: { status: 'running' } }),
          api.get('/api/games', { params: { status: 'scheduled,open' } }),
        ]);
        const running = Array.isArray(runningRes.data?.games) ? runningRes.data.games : [];
        const scheduled = Array.isArray(scheduledRes.data?.games) ? scheduledRes.data.games : [];
        if (!cancelled) {
          setRunningGames(running);
          setScheduledGames(scheduled);
        }
      } catch {
        if (!cancelled) {
          setRunningGames([]);
          setScheduledGames([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleJoinGame = (game) => {
    if (!game || game.status !== 'running') return;
    const roomId = game._id ?? game.id;
    const entryFee = game.stakeEtb ?? 0;
    if (game.roundStatus === 'cartela_selection') {
      navigate('/cartela', { state: { roomId, entryFee } });
    } else if (game.roundStatus === 'playing') {
      navigate('/game', {
        state: { roomId, entryFee },
      });
    } else if (game.roundStatus === 'winner') {
      const winners = Array.isArray(game.roundWinners) && game.roundWinners.length > 0
        ? game.roundWinners
        : (game.roundWinner ? [game.roundWinner] : undefined);
      navigate('/win', {
        state: { roomId, entryFee, roundWinner: game.roundWinner, winners, roundWinners: game.roundWinners },
      });
    } else {
      navigate('/cartela', { state: { roomId, entryFee } });
    }
  };

  return (
    <div
      className="flex-1 flex flex-col font-outfit min-h-0"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <LobbyHeader />

      {showWelcomeInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="w-full max-w-md rounded-2xl bg-[#020817] border border-slate-800 shadow-bingo-card p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Important Information"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Important Information</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.setItem('bingo_welcome_info_v1', '1'); } catch {}
                  setShowWelcomeInfo(false);
                }}
                className="text-slate-400 hover:text-slate-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-2 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              Welcome to Bingo Game!
              {'\n\n'}
              ውድ የቢንጎ ቤተሰቦቻችን በብዙዎቻቹ ጥያቄ መሰረት
              {'\n'}
              ⚡️ በተመሳሳይ ጊዜ ቢንጎ ለሚሉ ሰዎች አሸናፊዎችን እኩል የምናካፍል መሆኑን እናሳውቃለን
              {'\n'}
              ⚡️ ሙሉ በሙሉ card ቁጥር ከመምረጥ ውጪ ሙሉ በሙሉ ሁሉም ነገር Automatic መሆኑን እናሳውቃለን
              {'\n'}
              ⚡️ Card ይምረጡ ፥ ተጨማሪ እስከ 4 Card ይምረጡ ፥ እድሎን ይሞክሩ
              {'\n'}
              ⚡️ ማሳሰቢያ ለመጫዎት ምንም መንካት አይጠበቅቦትም
            </div>

            <button
              type="button"
              onClick={() => {
                try { localStorage.setItem('bingo_welcome_info_v1', '1'); } catch {}
                setShowWelcomeInfo(false);
              }}
              className="mt-4 w-full rounded-2xl bg-bingoGold text-bingoDark font-extrabold py-3 shadow-bingo-card active:scale-[0.99] transition"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-white/50 mb-5 max-w-md">
        Select a room to join a live Bingo game. Your Telegram account is used to join securely.
      </p>

      {scheduledGames.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[0.7rem] font-semibold text-neonCyan/90 uppercase tracking-widest mb-3">
            ⏳ Scheduled (Discount Time)
          </h2>
          <div className="space-y-3">
            {scheduledGames.map((game) => (
              <GameRoomCard
                key={game._id}
                label={`Room ${game.stakeEtb ?? 0} ETB`}
                roomLabel={`Room ${game.stakeEtb ?? 0} ETB`}
                roundLabel={null}
                entryFee={game.stakeEtb ?? 0}
                subtitle={getStartsInText(game)}
                disabled
                isRunning={false}
                playerCount={game.playerCount ?? 0}
                playerLimit={game.playerLimit ?? 12}
              />
            ))}
          </div>
        </div>
      )}

      <h2 className="text-[0.7rem] font-semibold text-neonRose/90 uppercase tracking-widest mb-3">
        🔥 Running Games
      </h2>
      <div className="space-y-3">
        {loading && (
          <div className="text-sm text-white/40 py-4">Loading rooms…</div>
        )}
        {!loading && runningGames.length > 0 && runningGames.map((game) => (
          <GameRoomCard
            key={game._id}
            label={`Room ${game.stakeEtb ?? 0} ETB`}
            roomLabel={`Room ${game.stakeEtb ?? 0} ETB`}
            entryFee={game.stakeEtb ?? 0}
            onClick={() => handleJoinGame(game)}
            isRunning
            playerCount={game.playerCount ?? 0}
            playerLimit={game.playerLimit ?? 12}
          />
        ))}
        {!loading && runningGames.length === 0 && scheduledGames.length === 0 && (
          <div className="text-sm text-white/40 py-4">
            No games open. Check back later.
          </div>
        )}
        {!loading && runningGames.length === 0 && scheduledGames.length > 0 && (
          <div className="text-sm text-white/40 py-4">
            No games running yet. Join when a scheduled game starts.
          </div>
        )}
      </div>

    </div>
  );
};

export default Lobby;
