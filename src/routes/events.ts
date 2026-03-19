import { Router } from "express";
import { z } from "zod";
import { hasConflict } from "../lib/time.js";
import { lineWorksClient } from "../integrations/lineworks.js";
import { asyncHandler } from "../lib/async-handler.js";
import { getUserToken } from "../auth/user-token-store.js";
import { config } from "../config.js";

const createEventSchema = z.object({
  actorUserId: z.string().min(1),
  calendarId: z.string().min(1),
  title: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  participantUserIds: z.array(z.string().min(1)).min(2),
  idempotencyKey: z.string().min(1)
});

const idempotentMap = new Map<string, { eventId: string; createdAt: number }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function cleanupIdempotency(): void {
  const now = Date.now();
  for (const [k, v] of idempotentMap) {
    if (now - v.createdAt > IDEMPOTENCY_TTL_MS) idempotentMap.delete(k);
  }
}

export const eventsRouter = Router();

eventsRouter.post("/", asyncHandler(async (req, res) => {
  cleanupIdempotency();
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid event payload", details: parsed.error.flatten() }
    });
  }
  const input = parsed.data;
  const userToken = getUserToken();
  if (!config.useMock && !userToken) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "User OAuth login required. Open /api/v1/auth/login first.",
        details: {}
      }
    });
  }
  const duplicate = idempotentMap.get(input.idempotencyKey);
  if (duplicate) {
    return res.status(200).json({ eventId: duplicate.eventId, status: "already_created" });
  }

  const busyMap = await lineWorksClient.fetchBusyIntervals(input.participantUserIds, {
    from: input.start,
    to: input.end
  });
  const recheck = hasConflict(
    { startMs: new Date(input.start).getTime(), endMs: new Date(input.end).getTime() },
    input.participantUserIds,
    busyMap
  );

  if (!recheck.available) {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Selected slot is no longer available",
        details: { conflicts: recheck.conflicts }
      }
    });
  }

  const created = await lineWorksClient.createEvent({
    calendarId: input.calendarId,
    title: input.title,
    start: input.start,
    end: input.end,
    participantUserIds: input.participantUserIds
  }, { accessToken: userToken?.accessToken });
  idempotentMap.set(input.idempotencyKey, { eventId: created.eventId, createdAt: Date.now() });
  return res.status(201).json({ eventId: created.eventId, status: "created" });
}));
