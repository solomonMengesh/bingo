/**
 * Centralized sound manager for Bingo game.
 * - Plays number sounds (b-1.mp3 … o-75.mp3) and winner sound (bingo.mp3).
 * - One playback at a time; new play stops the previous.
 * - Unlock on first user interaction for Telegram Mini App / autoplay policies.
 * - Caches Audio instances for fast replay.
 */

const SOUNDS_BASE = process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/sounds` : '/sounds';

function getLetterForNumber(n) {
  if (n >= 1 && n <= 15) return 'b';
  if (n >= 16 && n <= 30) return 'i';
  if (n >= 31 && n <= 45) return 'n';
  if (n >= 46 && n <= 60) return 'g';
  if (n >= 61 && n <= 75) return 'o';
  return null;
}

function getNumberSoundPath(value) {
  const num = Number(value);
  if (num < 1 || num > 75) return null;
  const letter = getLetterForNumber(num);
  return letter ? `${SOUNDS_BASE}/${letter}-${num}.mp3` : null;
}

const numberCache = new Map();
let bingoAudio = null;
let currentPlayback = null;
let unlocked = false;
let enabled = true;

function stopCurrent() {
  if (currentPlayback) {
    try {
      currentPlayback.pause();
      currentPlayback.currentTime = 0;
    } catch (_) {}
    currentPlayback = null;
  }
}

function getOrCreateNumberAudio(value) {
  const path = getNumberSoundPath(value);
  if (!path) return null;
  if (numberCache.has(path)) return numberCache.get(path);
  const audio = new Audio(path);
  numberCache.set(path, audio);
  return audio;
}

function getBingoAudio() {
  if (bingoAudio) return bingoAudio;
  bingoAudio = new Audio(`${SOUNDS_BASE}/bingo.mp3`);
  return bingoAudio;
}

/**
 * Call once after user gesture (e.g. first tap/click) to allow playback.
 * Required for Telegram Mini App and browser autoplay policies.
 */
function unlock() {
  if (unlocked) return;
  unlocked = true;
  // Optional: preload winner sound for fast play on round_winner
  getBingoAudio().load?.();
}

/**
 * Enable or disable playback. When false, playNumber/playBingo do nothing.
 */
function setEnabled(on) {
  enabled = !!on;
  if (!enabled) stopCurrent();
}

function isEnabled() {
  return enabled;
}

/**
 * Play the sound for a called number (1–75).
 * Stops any currently playing sound first.
 */
function playNumber(value) {
  if (!enabled || !unlocked) return;
  const num = Number(value);
  if (num < 1 || num > 75) return;
  stopCurrent();
  const audio = getOrCreateNumberAudio(num);
  if (!audio) return;
  currentPlayback = audio;
  audio.currentTime = 0;
  const onEnd = () => {
    if (currentPlayback === audio) currentPlayback = null;
    audio.removeEventListener('ended', onEnd);
  };
  audio.addEventListener('ended', onEnd);
  audio.play().catch(() => {
    if (currentPlayback === audio) currentPlayback = null;
  });
}

/**
 * Play the winner (bingo) sound once.
 * Stops any currently playing sound first.
 */
function playBingo() {
  if (!enabled || !unlocked) return;
  stopCurrent();
  const audio = getBingoAudio();
  currentPlayback = audio;
  audio.currentTime = 0;
  const onEnd = () => {
    if (currentPlayback === audio) currentPlayback = null;
    audio.removeEventListener('ended', onEnd);
  };
  audio.addEventListener('ended', onEnd);
  audio.play().catch(() => {
    if (currentPlayback === audio) currentPlayback = null;
  });
}

/**
 * Optional: preload number sounds in background after unlock.
 * Call after unlock() to reduce first-play delay for numbers.
 */
function preloadNumberSounds() {
  if (!unlocked) return;
  const preload = (num) => {
    if (num > 75) return;
    getOrCreateNumberAudio(num);
    setTimeout(() => preload(num + 1), 30);
  };
  preload(1);
}

export default {
  unlock,
  setEnabled,
  isEnabled,
  playNumber,
  playBingo,
  preloadNumberSounds,
  getNumberSoundPath,
};
