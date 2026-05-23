const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const REMEMBER_KEY = "wekala_remember_me";

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

export function getToken(): string {
  const w = safeWindow();
  if (!w) return "";
  return w.localStorage.getItem(ACCESS_KEY) ?? w.sessionStorage.getItem(ACCESS_KEY) ?? "";
}

export function setTokens(
  access: string,
  refresh: string | undefined,
  options: { remember: boolean }
): void {
  const w = safeWindow();
  if (!w) return;
  const store = options.remember ? w.localStorage : w.sessionStorage;
  const other = options.remember ? w.sessionStorage : w.localStorage;
  store.setItem(ACCESS_KEY, access);
  if (refresh) store.setItem(REFRESH_KEY, refresh);
  other.removeItem(ACCESS_KEY);
  other.removeItem(REFRESH_KEY);
  if (options.remember) {
    w.localStorage.setItem(REMEMBER_KEY, "1");
  } else {
    w.localStorage.removeItem(REMEMBER_KEY);
  }
}

export function clearTokens(): void {
  const w = safeWindow();
  if (!w) return;
  w.sessionStorage.removeItem(ACCESS_KEY);
  w.sessionStorage.removeItem(REFRESH_KEY);
  w.localStorage.removeItem(ACCESS_KEY);
  w.localStorage.removeItem(REFRESH_KEY);
  w.localStorage.removeItem(REMEMBER_KEY);
}

export function rememberMePreferred(): boolean {
  const w = safeWindow();
  if (!w) return false;
  return w.localStorage.getItem(REMEMBER_KEY) === "1";
}
