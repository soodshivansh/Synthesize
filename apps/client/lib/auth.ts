const TOKEN_KEY = "github_access_token";
const EXPIRY_KEY = "github_token_expiry";

export function setAuthToken(token: string, expiresInMs: number): void {
  if (typeof window === "undefined") return;
  
  const expiryTime = Date.now() + expiresInMs;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);
  
  if (!token || !expiry) return null;
  
  // Check if token has expired
  if (Date.now() > parseInt(expiry, 10)) {
    clearAuthToken();
    return null;
  }
  
  return token;
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}
