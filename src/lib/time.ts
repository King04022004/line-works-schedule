import { Candidate, SearchRequest, TimeInterval } from "../types.js";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(":").map(Number);
  return { hour: h, minute: m };
}

function startOfLocalDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: TimeInterval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function subtractBusy(window: TimeInterval, busy: TimeInterval[]): TimeInterval[] {
  const mergedBusy = mergeIntervals(
    busy
      .filter((b) => b.endMs > window.startMs && b.startMs < window.endMs)
      .map((b) => ({
        startMs: Math.max(window.startMs, b.startMs),
        endMs: Math.min(window.endMs, b.endMs)
      }))
  );
  const free: TimeInterval[] = [];
  let cursor = window.startMs;
  for (const b of mergedBusy) {
    if (b.startMs > cursor) free.push({ startMs: cursor, endMs: b.startMs });
    cursor = Math.max(cursor, b.endMs);
  }
  if (cursor < window.endMs) free.push({ startMs: cursor, endMs: window.endMs });
  return free;
}

function intersectMany(list: TimeInterval[][]): TimeInterval[] {
  if (list.length === 0) return [];
  let acc = list[0];
  for (let i = 1; i < list.length; i += 1) {
    const next: TimeInterval[] = [];
    let p1 = 0;
    let p2 = 0;
    const other = list[i];
    while (p1 < acc.length && p2 < other.length) {
      const a = acc[p1];
      const b = other[p2];
      const startMs = Math.max(a.startMs, b.startMs);
      const endMs = Math.min(a.endMs, b.endMs);
      if (startMs < endMs) next.push({ startMs, endMs });
      if (a.endMs < b.endMs) p1 += 1;
      else p2 += 1;
    }
    acc = next;
    if (acc.length === 0) return [];
  }
  return acc;
}

function buildBusinessWindows(input: SearchRequest): TimeInterval[] {
  const from = new Date(input.range.from);
  const to = new Date(input.range.to);
  const { hour: startH, minute: startM } = parseHm(input.options.businessHours.start);
  const { hour: endH, minute: endM } = parseHm(input.options.businessHours.end);

  const windows: TimeInterval[] = [];
  const dayStart = startOfLocalDayMs(from);
  for (let t = dayStart; t < to.getTime(); t += DAY_MS) {
    const d = new Date(t);
    if (input.options.excludeWeekends && isWeekend(d)) continue;
    const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startH, startM).getTime();
    const endMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endH, endM).getTime();
    const clampedStart = Math.max(startMs, from.getTime());
    const clampedEnd = Math.min(endMs, to.getTime());
    if (clampedStart < clampedEnd) {
      windows.push({ startMs: clampedStart, endMs: clampedEnd });
    }
  }
  return windows;
}

function toIso(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
}

function buildCandidateId(startMs: number, endMs: number): string {
  const s = new Date(startMs);
  const e = new Date(endMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `cand_${s.getFullYear()}${pad(s.getMonth() + 1)}${pad(s.getDate())}_${pad(s.getHours())}${pad(s.getMinutes())}_${pad(e.getHours())}${pad(e.getMinutes())}`;
}

export function computeCandidates(
  input: SearchRequest,
  busyMap: Record<string, TimeInterval[]>,
  minLeadMinutes: number
): Candidate[] {
  const windows = buildBusinessWindows(input);
  const nowThreshold = Date.now() + minLeadMinutes * MINUTE_MS;
  const durationMs = input.durationMinutes * MINUTE_MS;
  const out: Candidate[] = [];

  for (const window of windows) {
    const eachUserFree = input.participantUserIds.map((userId) =>
      subtractBusy(window, busyMap[userId] ?? [])
    );
    const common = intersectMany(eachUserFree);
    for (const c of common) {
      let cursor = c.startMs;
      while (cursor + durationMs <= c.endMs) {
        const startMs = cursor;
        const endMs = cursor + durationMs;
        if (startMs >= nowThreshold) {
          out.push({
            candidateId: buildCandidateId(startMs, endMs),
            start: toIso(startMs),
            end: toIso(endMs),
            participantUserIds: input.participantUserIds
          });
        }
        cursor += durationMs;
      }
    }
  }

  return out
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, input.options.resultLimit);
}

export function hasConflict(
  interval: TimeInterval,
  participantUserIds: string[],
  busyMap: Record<string, TimeInterval[]>
): { available: boolean; conflicts: string[] } {
  const conflicts = participantUserIds.filter((uid) =>
    (busyMap[uid] ?? []).some((b) => b.startMs < interval.endMs && b.endMs > interval.startMs)
  );
  return { available: conflicts.length === 0, conflicts };
}
