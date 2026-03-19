import { TimeInterval } from "../types.js";

export type CreateEventInput = {
  calendarId: string;
  title: string;
  start: string;
  end: string;
  participantUserIds: string[];
};

export interface LineWorksIntegration {
  fetchBusyIntervals(
    participantUserIds: string[],
    range: { from: string; to: string }
  ): Promise<Record<string, TimeInterval[]>>;
  createEvent(input: CreateEventInput, options?: { accessToken?: string }): Promise<{ eventId: string }>;
}
