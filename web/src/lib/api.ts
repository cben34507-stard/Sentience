import type {
  Achievement,
  DailyHealthSummary,
  Event,
  EventInput,
  Fact,
  FactInput,
  GoalInput,
  GoalStatus,
  LabResult,
  LabResultInput,
  Profile,
  ProfileInput,
} from "@sentience/shared";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body?.error ?? res.statusText);
  return body as T;
}

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, body: unknown) => request<T>(p, { method: "POST", body: JSON.stringify(body) });
const put = <T>(p: string, body: unknown) => request<T>(p, { method: "PUT", body: JSON.stringify(body) });
const del = (p: string) => request<void>(p, { method: "DELETE" });

export interface DayView {
  date: string;
  timezone: string;
  range: { start: string; end: string };
  events: Event[];
  health: DailyHealthSummary | null;
  heartRate: { t: string; v: number }[];
  stepsByHour: (number | null)[];
  goals: GoalStatus[];
  labResults: LabResult[];
}

export interface TimelineDay {
  date: string;
  range: { start: string; end: string };
  events: { id: string; category: Event["category"]; title: string; startAt: string; endAt: string | null; rating: number | null }[];
  sleep: { startAt: string; endAt: string }[];
  heartRateByHour: (number | null)[];
}

export interface OverviewDay {
  date: string;
  eventCount: number;
  categories: string[];
  steps: number | null;
  sleepMin: number | null;
  restingHr: number | null;
  hrAvg: number | null;
  activeKcal: number | null;
  workouts: number;
  moodAvg: number | null;
}
export interface Overview {
  from: string;
  to: string;
  days: OverviewDay[];
  streak: { longest: number; current: number };
}

export interface Stats {
  today: string;
  timezone: string;
  events: number;
  daysLogged: number;
  streak: { longest: number; current: number };
  health: { first: string | null; last: string | null; samples: number; workouts: number; sources?: string[] };
  facts: number;
  goals: number;
}

export interface ImportJob {
  id: string;
  filename: string;
  status: "queued" | "hashing" | "running" | "done" | "duplicate" | "error";
  recordsSeen: number;
  recordsAdded: number;
  recordsSkipped: number;
  exportDate: string | null;
  workoutsSeen: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface TypeStat {
  type: string;
  count: number;
  first: string;
  last: string;
  unit: string;
  sources: number;
}

export const api = {
  stats: () => get<Stats>("/stats"),
  day: (date: string) => get<DayView>(`/day?date=${date}`),
  overview: (from: string, to: string) => get<Overview>(`/overview?from=${from}&to=${to}`),
  timeline: (from: string, to: string) => get<{ from: string; to: string; timezone: string; days: TimelineDay[] }>(`/timeline?from=${from}&to=${to}`),

  labs: {
    list: () => get<LabResult[]>("/labs"),
    create: (input: LabResultInput) => post<LabResult & { duplicate: boolean }>("/labs", input),
    bulk: (items: LabResultInput[]) => post<{ created: number; duplicates: number }>("/labs/bulk", items),
    update: (id: string, input: Partial<LabResultInput>) => put<LabResult>(`/labs/${id}`, input),
    remove: (id: string) => del(`/labs/${id}`),
  },

  events: {
    create: (input: EventInput) => post<Event>("/events", input),
    update: (id: string, input: Partial<EventInput>) => put<Event>(`/events/${id}`, input),
    remove: (id: string) => del(`/events/${id}`),
  },

  profile: {
    get: () => get<Profile>("/profile"),
    update: (input: ProfileInput) => put<Profile>("/profile", input),
  },
  facts: {
    list: () => get<Fact[]>("/facts"),
    create: (input: FactInput) => post<Fact>("/facts", input),
    bulk: (items: FactInput[]) => post<{ created: number }>("/facts/bulk", items),
    update: (id: string, input: Partial<FactInput>) => put<Fact>(`/facts/${id}`, input),
    remove: (id: string) => del(`/facts/${id}`),
  },

  goals: {
    list: (date?: string, archived = false) => get<GoalStatus[]>(`/goals?${date ? `date=${date}&` : ""}${archived ? "archived=1" : ""}`),
    create: (input: GoalInput) => post<GoalStatus>("/goals", input),
    update: (id: string, input: Partial<GoalInput>) => put<GoalStatus>(`/goals/${id}`, input),
    remove: (id: string) => del(`/goals/${id}`),
    progress: (id: string, amount: number, date?: string, note?: string) => post<GoalStatus>(`/goals/${id}/progress`, { amount, date, note }),
  },
  achievements: () => get<Achievement[]>("/achievements"),

  health: {
    types: () => get<TypeStat[]>("/health/types"),
    coverage: () => get<Stats["health"]>("/health/coverage"),
    imports: () => get<ImportJob[]>("/health/import"),
    importStatus: (id: string) => get<ImportJob>(`/health/import/${id}`),
    upload: (file: File, force = false) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<ImportJob>(`/health/import${force ? "?force=1" : ""}`, { method: "POST", body: fd });
    },
  },

  exportUrl: (from: string, to: string, format: "json" | "md", download = true) =>
    `/api/export?from=${from}&to=${to}&format=${format}${download ? "&download=1" : ""}`,
  exportMarkdown: (from: string, to: string) => fetch(`/api/export?from=${from}&to=${to}&format=md`).then((r) => r.text()),
};
