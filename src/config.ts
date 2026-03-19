import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  minLeadMinutes: Number(process.env.MIN_LEAD_MINUTES ?? 30),
  defaultResultLimit: Number(process.env.DEFAULT_RESULT_LIMIT ?? 5),
  useMock: String(process.env.LW_USE_MOCK ?? "true").toLowerCase() !== "false",
  lineWorks: {
    apiBaseUrl: process.env.LW_API_BASE_URL ?? "",
    authTokenUrl: process.env.LW_AUTH_TOKEN_URL ?? "",
    clientId: process.env.LW_CLIENT_ID ?? "",
    clientSecret: process.env.LW_CLIENT_SECRET ?? "",
    serviceAccount: process.env.LW_SERVICE_ACCOUNT ?? "",
    privateKey: process.env.LW_PRIVATE_KEY ?? "",
    privateKeyPath: process.env.LW_PRIVATE_KEY_PATH ?? "",
    busyPathTemplate:
      process.env.LW_CALENDAR_BUSY_PATH_TEMPLATE ??
      "/users/{userId}/calendar/events?fromDateTime={from}&untilDateTime={to}",
    createEventPathTemplate:
      process.env.LW_CALENDAR_CREATE_PATH_TEMPLATE ??
      "/users/{calendarId}/calendar/events",
    oauthRedirectUri: process.env.LW_OAUTH_REDIRECT_URI ?? "http://localhost:3000/api/v1/auth/callback",
    oauthScopes: process.env.LW_OAUTH_SCOPES ?? "calendar calendar.read directory directory.read"
  }
};
