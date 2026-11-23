/*
 * Минимальное хранение сессии: токен лежит в sessionStorage вкладки и
 * пропадает при её закрытии. Если хранилище недоступно (приватный режим,
 * запрет сайта), сессия живёт только до перезагрузки страницы.
 */

export const SESSION_STORAGE_KEY = "gpo.auth.session";

let memorySession = null;
let memoryDemo = false;
const DEMO_STORAGE_KEY = "gpo.demo.active";

const storage = () => {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
};

const isExpired = (session, now) => {
  if (!session.expiresAt) return false;
  const expires = Date.parse(session.expiresAt);
  return Number.isFinite(expires) && expires <= now;
};

export function getSession(now = Date.now()) {
  let session = memorySession;
  try {
    const raw = storage()?.getItem(SESSION_STORAGE_KEY);
    if (raw) session = JSON.parse(raw);
  } catch {
    // повреждённая запись — считаем, что сессии нет
  }
  if (!session || typeof session.token !== "string" || !session.token) return null;
  if (isExpired(session, now)) {
    clearSession();
    return null;
  }
  return session;
}

export function enterDemo() {
  memoryDemo = true;
  try { storage()?.setItem(DEMO_STORAGE_KEY, "1"); } catch { /* Session remains in memory. */ }
}

export function hasDemo() {
  try { return memoryDemo || storage()?.getItem(DEMO_STORAGE_KEY) === "1"; } catch { return memoryDemo; }
}

export function saveSession({ token, expiresAt = null, user = {} }) {
  const session = { token, expiresAt, login: user.login || "" };
  memorySession = session;
  try {
    storage()?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // остаётся только копия в памяти
  }
  return session;
}

export function clearSession() {
  memorySession = null;
  memoryDemo = false;
  try {
    storage()?.removeItem(DEMO_STORAGE_KEY);
    storage()?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // нечего очищать
  }
}

// Заголовок для будущих защищённых запросов; схема передачи токена не согласована.
export function authHeaders(session = getSession()) {
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
