export type DateRange = {
  from: string;
  to: string;
};

export type SearchOptions = {
  businessHours: {
    start: string;
    end: string;
  };
  excludeWeekends: boolean;
  resultLimit: number;
};

export type SearchRequest = {
  actorUserId: string;
  participantUserIds: string[];
  durationMinutes: 30 | 60;
  range: DateRange;
  options: SearchOptions;
};

export type Candidate = {
  candidateId: string;
  start: string;
  end: string;
  participantUserIds: string[];
};

export type TimeInterval = {
  startMs: number;
  endMs: number;
};
