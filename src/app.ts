import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { availabilityRouter } from "./routes/availability.js";
import { eventsRouter } from "./routes/events.js";
import { directoryRouter } from "./routes/directory.js";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  const here = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(here, "..", "public");
  app.use(express.static(publicDir));

  app.get("/", (_req, res) =>
    res.json({
      name: "line-works-schedule-api",
      ok: true,
      endpoints: [
        "/health",
        "/api/v1/members",
        "/api/v1/groups",
        "/api/v1/groups/:groupId/members",
        "/api/v1/availability/search",
        "/api/v1/availability/recheck",
        "/api/v1/events",
        "/api/v1/auth/login",
        "/api/v1/auth/callback",
        "/api/v1/auth/status",
        "/woff"
      ]
    })
  );
  app.get("/woff", (_req, res) => {
    res.sendFile(path.join(publicDir, "woff.html"));
  });
  app.get("/health", (_req, res) => res.json({ ok: true, mode: config.useMock ? "mock" : "live" }));
  app.use("/api/v1", directoryRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/availability", availabilityRouter);
  app.use("/api/v1/events", eventsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message,
        details: {}
      }
    });
  });
  return app;
}
