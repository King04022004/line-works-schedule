import { createSign, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "../config.js";

type TokenCache = { accessToken: string; expiresAtMs: number } | null;
let tokenCache: TokenCache = null;

function required(v: string, name: string): string {
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function base64Url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function normalizePrivateKeyPem(raw: string): string {
  const text = raw.trim().replace(/\\n/g, "\n");
  if (text.includes("BEGIN PRIVATE KEY")) return text;
  const base64Only = text.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(base64Only)) {
    throw new Error("Private key format is invalid. Use PEM or base64 PKCS8 key.");
  }
  const chunks = base64Only.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${chunks.join("\n")}\n-----END PRIVATE KEY-----`;
}

function resolvePrivateKey(): string {
  const raw = config.lineWorks.privateKeyPath
    ? readFileSync(config.lineWorks.privateKeyPath, "utf8")
    : required(config.lineWorks.privateKey, "LW_PRIVATE_KEY");
  return normalizePrivateKeyPem(raw);
}

function buildJwtAssertion(input: {
  tokenUrl: string;
  clientId: string;
  serviceAccount: string;
  privateKeyPem: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: input.clientId,
    sub: input.serviceAccount,
    aud: input.tokenUrl,
    iat: now,
    exp: now + 60 * 5,
    jti: randomUUID()
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(input.privateKeyPem, "base64url");
  return `${signingInput}.${signature}`;
}

async function getServiceAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 10_000) {
    return tokenCache.accessToken;
  }

  const tokenUrl = required(config.lineWorks.authTokenUrl, "LW_AUTH_TOKEN_URL");
  const clientId = required(config.lineWorks.clientId, "LW_CLIENT_ID");
  const clientSecret = required(config.lineWorks.clientSecret, "LW_CLIENT_SECRET");
  const serviceAccount = required(config.lineWorks.serviceAccount, "LW_SERVICE_ACCOUNT");
  const privateKeyPem = resolvePrivateKey();
  const assertion = buildJwtAssertion({
    tokenUrl,
    clientId,
    serviceAccount,
    privateKeyPem
  });

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
    client_id: clientId,
    client_secret: clientSecret,
    scope: "bot"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE WORKS token failed: ${response.status} ${text}`);
  }
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  const accessToken = json.access_token;
  if (!accessToken) throw new Error("LINE WORKS token response missing access_token");
  const ttlSec = Number(json.expires_in ?? 3600);
  tokenCache = { accessToken, expiresAtMs: Date.now() + ttlSec * 1000 };
  return accessToken;
}

export async function callLineWorksAdminApi(input: {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  payload?: unknown;
}): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  const baseUrl = required(config.lineWorks.apiBaseUrl, "LW_API_BASE_URL");
  const token = await getServiceAccessToken();
  const response = await fetch(`${baseUrl}${input.path}`, {
    method: input.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: input.payload == null ? undefined : JSON.stringify(input.payload)
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data, text };
}
