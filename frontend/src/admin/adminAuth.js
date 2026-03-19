const STORAGE_KEY = 'bingo_admin_token';
const AUTH_FLAG_KEY = 'bingo_admin_auth';

export function getAdminToken() {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

export function setAdminAuth(token) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, token || '');
      window.localStorage.setItem(AUTH_FLAG_KEY, token ? '1' : '0');
    }
  } catch {
    // ignore
  }
}

export function clearAdminAuth() {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(AUTH_FLAG_KEY, '0');
    }
  } catch {
    // ignore
  }
}

export function isAdminAuthed() {
  if (typeof window === 'undefined') return false;
  try {
    const token = getAdminToken();
    return !!(token && token.length > 0) || window.localStorage.getItem(AUTH_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}
