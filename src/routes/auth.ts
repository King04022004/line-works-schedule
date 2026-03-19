import { Router } from "express";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { asyncHandler } from "../lib/async-handler.js";
import { clearUserToken, getUserToken, setUserToken } from "../auth/user-token-store.js";

const stateMap = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanupState(): void {
  const now = Date.now();
  for (const [k, createdAt] of stateMap) {
    if (now - createdAt > STATE_TTL_MS) stateMap.delete(k);
  }
}

function required(v: string, name: string): string {
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const authRouter = Router();

authRouter.get("/login", (_req, res) => {
  cleanupState();
  const state = randomUUID();
  stateMap.set(state, Date.now());
  const clientId = required(config.lineWorks.clientId, "LW_CLIENT_ID");
  const authUrl = new URL("https://auth.worksmobile.com/oauth2/v2.0/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", config.lineWorks.oauthRedirectUri);
  authUrl.searchParams.set("scope", config.lineWorks.oauthScopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "consent");
  res.redirect(authUrl.toString());
});

authRouter.get("/callback", asyncHandler(async (req, res) => {
  cleanupState();
  const state = String(req.query.state ?? "");
  const code = String(req.query.code ?? "");
  const error = String(req.query.error ?? "");
  if (error) {
    return res.status(400).json({ error: { code: "AUTH_ERROR", message: error, details: req.query } });
  }
  if (!state || !stateMap.has(state)) {
    return res.status(400).json({ error: { code: "AUTH_ERROR", message: "Invalid state", details: {} } });
  }
  stateMap.delete(state);
  if (!code) {
    return res.status(400).json({ error: { code: "AUTH_ERROR", message: "Missing code", details: {} } });
  }

  const tokenUrl = required(config.lineWorks.authTokenUrl, "LW_AUTH_TOKEN_URL");
  const clientId = required(config.lineWorks.clientId, "LW_CLIENT_ID");
  const clientSecret = required(config.lineWorks.clientSecret, "LW_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.lineWorks.oauthRedirectUri,
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token exchange failed: ${response.status} ${text}`);
  }
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) throw new Error("OAuth token response missing access_token");
  setUserToken({
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAtMs: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined
  });

  res.json({ ok: true, message: "LINE WORKS login completed. You can now call POST /api/v1/events." });
}));

authRouter.get("/status", (_req, res) => {
  const token = getUserToken();
  res.json({ loggedIn: !!token, expiresAt: token?.expiresAtMs ?? null });
});

authRouter.post("/logout", (_req, res) => {
  clearUserToken();
  res.json({ ok: true });
});
