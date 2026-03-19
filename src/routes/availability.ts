import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { computeCandidates, hasConflict } from "../lib/time.js";
import { lineWorksClient } from "../integrations/lineworks.js";
import { asyncHandler } from "../lib/async-handler.js";

const hmRegex = /^\d{2}:\d{2}$/;

const searchSchema = z.object({
  actorUserId: z.string().min(1),
  participantUserIds: z.array(z.string().min(1)).min(2),
  durationMinutes: z.union([z.literal(30), z.literal(60)]),
  range: z.object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true })
  }),
  options: z.object({
    businessHours: z.object({
      start: z.string().regex(hmRegex),
      end: z.string().regex(hmRegex)
    }),
    excludeWeekends: z.boolean(),
    resultLimit: z.number().int().min(1).max(10)
  })
});

const recheckSchema = z.object({
  participantUserIds: z.array(z.string().min(1)).min(2),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true })
});

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

export const availabilityRouter = Router();

availabilityRouter.post("/search", asyncHandler(async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid search payload", details: parsed.error.flatten() }
    });
  }

  const input = parsed.data;
  const users = dedupe(input.participantUserIds);
  if (users.length < 2) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "At least 2 unique participants are required", details: {} }
    });
  }
  const from = new Date(input.range.from).getTime();
  const to = new Date(input.range.to).getTime();
  const maxRangeMs = 7 * 24 * 60 * 60 * 1000;
  if (to <= from || to - from > maxRangeMs) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Range must be within 7 days and from < to", details: {} }
    });
  }

  const busyMap = await lineWorksClient.fetchBusyIntervals(users, input.range);
  const candidates = computeCandidates({ ...input, participantUserIds: users }, busyMap, config.minLeadMinutes);
  return res.json({ candidates, total: candidates.length });
}));

availabilityRouter.post("/recheck", asyncHandler(async (req, res) => {
  const parsed = recheckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid recheck payload", details: parsed.error.flatten() }
    });
  }
  const input = parsed.data;
  const busyMap = await lineWorksClient.fetchBusyIntervals(input.participantUserIds, {
    from: input.start,
    to: input.end
  });
  const result = hasConflict(
    { startMs: new Date(input.start).getTime(), endMs: new Date(input.end).getTime() },
    input.participantUserIds,
    busyMap
  );
  return res.json(result);
}));
