import { config } from "../config.js";
import { TimeInterval } from "../types.js";
import { CreateEventInput, LineWorksIntegration } from "./lineworks.types.js";
import { readFileSync } from "node:fs";
import { createSign, randomUUID } from "node:crypto";

type TokenCache = { accessToken: string; expiresAtMs: number } | null;

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

function toUnixMs(isoOrMs: string | number): number {
  if (typeof isoOrMs === "number") return isoOrMs;
  const parsed = Date.parse(isoOrMs);
  if (!Number.isNaN(parsed)) return parsed;
  const asNum = Number(isoOrMs);
  if (!Number.isNaN(asNum)) return asNum;
  throw new Error(`Unsupported time format: ${isoOrMs}`);
}

function toLocalDateTimeText(input: string): string {
  const d = new Date(input);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeBusyIntervals(raw: unknown): TimeInterval[] {
  if (!Array.isArray(raw)) return [];
  const out: TimeInterval[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const start = obj.start ?? obj.startTime ?? obj.begin;
    const end = obj.end ?? obj.endTime ?? obj.finish;
    if (start == null || end == null) continue;
    try {
      const startMs = toUnixMs(start as string | number);
      const endMs = toUnixMs(end as string | number);
      if (startMs < endMs) out.push({ startMs, endMs });
    } catch {
      // ignore invalid row
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

export class LineWorksApiClient implements LineWorksIntegration {
  private tokenCache: TokenCache = null;

  private resolvePrivateKey(): string {
    const raw = config.lineWorks.privateKeyPath
      ? readFileSync(config.lineWorks.privateKeyPath, "utf8")
      : required(config.lineWorks.privateKey, "LW_PRIVATE_KEY");
    return normalizePrivateKeyPem(raw);
  }

  private buildJwtAssertion(input: {
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

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAtMs > now + 10_000) {
      return this.tokenCache.accessToken;
    }

    const tokenUrl = required(config.lineWorks.authTokenUrl, "LW_AUTH_TOKEN_URL");
    const clientId = required(config.lineWorks.clientId, "LW_CLIENT_ID");
    const clientSecret = required(config.lineWorks.clientSecret, "LW_CLIENT_SECRET");
    const serviceAccount = required(config.lineWorks.serviceAccount, "LW_SERVICE_ACCOUNT");
    const privateKeyPem = this.resolvePrivateKey();
    const assertion = this.buildJwtAssertion({
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
      scope: "calendar calendar.read directory directory.read"
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
    this.tokenCache = { accessToken, expiresAtMs: Date.now() + ttlSec * 1000 };
    return accessToken;
  }

  private async api<T>(path: string, init?: RequestInit, accessTokenOverride?: string): Promise<T> {
    const baseUrl = required(config.lineWorks.apiBaseUrl, "LW_API_BASE_URL");
    const token = accessTokenOverride ?? (await this.getAccessToken());
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LINE WORKS API failed (${path}): ${response.status} ${text}`);
    }
    return (await response.json()) as T;
  }

  private async apiRaw(
    path: string,
    init?: RequestInit,
    accessTokenOverride?: string
  ): Promise<{ ok: boolean; status: number; text: string; json: unknown }> {
    const baseUrl = required(config.lineWorks.apiBaseUrl, "LW_API_BASE_URL");
    const token = accessTokenOverride ?? (await this.getAccessToken());
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, text, json };
  }

  async fetchBusyIntervals(
    participantUserIds: string[],
    range: { from: string; to: string }
  ): Promise<Record<string, TimeInterval[]>> {
    const map: Record<string, TimeInterval[]> = {};
    for (const userId of participantUserIds) {
      const path = config.lineWorks.busyPathTemplate
        .replace("{userId}", encodeURIComponent(userId))
        .replace("{from}", encodeURIComponent(range.from))
        .replace("{to}", encodeURIComponent(range.to));
      const res = await this.api<{ events?: unknown[]; items?: unknown[]; busy?: unknown[] }>(
        path
      );
      const rows = res.busy ?? res.events ?? res.items ?? [];
      map[userId] = normalizeBusyIntervals(rows);
    }
    return map;
  }

  async createEvent(
    input: CreateEventInput,
    options?: { accessToken?: string }
  ): Promise<{ eventId: string }> {
    const accessToken = options?.accessToken;
    const userPath = config.lineWorks.createEventPathTemplate.replace(
      "{calendarId}",
      encodeURIComponent(input.calendarId)
    );
    const payloads: unknown[] = [
      {
        eventComponents: [
          {
            summary: input.title,
            start: {
              dateTime: toLocalDateTimeText(input.start),
              timeZone: "Asia/Tokyo"
            },
            end: {
              dateTime: toLocalDateTimeText(input.end),
              timeZone: "Asia/Tokyo"
            },
            attendees: input.participantUserIds.map((v) => ({
              email: v
            }))
          }
        ],
        sendNotification: false
      },
      {
        summary: input.title,
        start: input.start,
        end: input.end,
        attendees: input.participantUserIds.map((v) => ({ id: v, email: v }))
      },
      {
        eventTitle: input.title,
        startDateTime: input.start,
        endDateTime: input.end,
        attendees: input.participantUserIds.map((v) => ({ email: v }))
      },
      {
        eventTitle: input.title,
        fromDateTime: input.start,
        untilDateTime: input.end,
        attendees: input.participantUserIds.map((v) => ({ email: v }))
      },
      {
        title: input.title,
        fromDateTime: input.start,
        untilDateTime: input.end
      },
      {
        summary: input.title,
        start: { dateTime: input.start },
        end: { dateTime: input.end }
      }
    ];

    const attempts: Array<{ path: string; payload: unknown }> = payloads.map((p) => ({
      path: userPath,
      payload: p
    }));

    const errors: string[] = [];
    for (const attempt of attempts) {
      const r = await this.apiRaw(
        attempt.path,
        { method: "POST", body: JSON.stringify(attempt.payload) },
        accessToken
      );
      if (!r.ok) {
        errors.push(`(${attempt.path}) status=${r.status} body=${r.text}`);
        continue;
      }
      const obj = (r.json ?? {}) as { id?: string; eventId?: string; eventComponents?: Array<{ eventId?: string }> };
      const eventId = obj.id ?? obj.eventId;
      if (eventId) return { eventId };
      if (obj.eventComponents?.[0]?.eventId) return { eventId: obj.eventComponents[0].eventId };
      if (r.text) return { eventId: `lw_${Date.now()}` };
    }
    throw new Error(`LINE WORKS API create event failed. attempts=${errors.join(" | ")}`);
  }
}
