const KEY = "pm:session";

export type Session =
  | { kind: "user"; code: string; loginAt: number; expiresAt: number; codeExpiresAt: number; prints: number }
  | { kind: "admin"; loginAt: number; expiresAt: number };

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (Date.now() > s.expiresAt) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}