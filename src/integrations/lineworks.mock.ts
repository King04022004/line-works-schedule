import { TimeInterval } from "../types.js";
import { CreateEventInput, LineWorksIntegration } from "./lineworks.types.js";

function dayAt(hour: number, minute: number, addDays = 0): number {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + addDays, hour, minute, 0, 0);
  return d.getTime();
}

function seededBusyForUser(userId: string): TimeInterval[] {
  const seed = [...userId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const morningShift = seed % 3; // 0..2
  const afternoonShift = seed % 2; // 0..1
  return [
    { startMs: dayAt(10 + morningShift, 0, 1), endMs: dayAt(10 + morningShift, 30, 1) },
    { startMs: dayAt(14 + afternoonShift, 0, 1), endMs: dayAt(15 + afternoonShift, 0, 1) },
    { startMs: dayAt(11 + morningShift, 0, 2), endMs: dayAt(12 + morningShift, 0, 2) }
  ];
}

export const mockLineWorksClient: LineWorksIntegration = {
  async fetchBusyIntervals(
    participantUserIds: string[],
    _range: { from: string; to: string }
  ): Promise<Record<string, TimeInterval[]>> {
    const map: Record<string, TimeInterval[]> = {};
    for (const uid of participantUserIds) {
      map[uid] = seededBusyForUser(uid);
    }
    return map;
  },

  async createEvent(_input: CreateEventInput): Promise<{ eventId: string }> {
    return { eventId: `evt_${Date.now()}` };
  }
};
