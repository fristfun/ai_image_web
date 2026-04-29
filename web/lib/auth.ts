const TOKEN_KEY = "ai_image_access_token";
const AUTH_CHANGED_EVENT = "auth-changed";

type JwtPayload = {
  sub?: string;
  role?: string;
  name?: string;
  exp?: number;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const value = normalized + padding;
  return atob(value);
}

function parseTokenPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const json = decodeBase64Url(payload);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getCurrentRole(): string | null {
  const token = getAccessToken();
  if (!token) {
    return null;
  }
  return parseTokenPayload(token)?.role ?? null;
}

export function getCurrentUsername(): string | null {
  const token = getAccessToken();
  if (!token) {
    return null;
  }
  return parseTokenPayload(token)?.name ?? null;
}

export function isTokenExpired(): boolean {
  const token = getAccessToken();
  if (!token) {
    return true;
  }
  const payload = parseTokenPayload(token);
  if (!payload?.exp) {
    return false;
  }
  return Date.now() >= payload.exp * 1000;
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) {
    return false;
  }
  return !isTokenExpired();
}

export function getAuthChangedEventName(): string {
  return AUTH_CHANGED_EVENT;
}
