type StoredToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAtMs?: number;
};

let token: StoredToken | null = null;

export function setUserToken(input: StoredToken): void {
  token = input;
}

export function getUserToken(): StoredToken | null {
  if (!token) return null;
  if (token.expiresAtMs && token.expiresAtMs <= Date.now()) return null;
  return token;
}

export function clearUserToken(): void {
  token = null;
}
