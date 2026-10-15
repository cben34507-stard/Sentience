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
  MealEstimate,
  NutritionDay,
  Insight,
  Profile,
  ProfileInput,
  Reminder,
  ReminderDose,
  ReminderInput,
  ReminderStatus,
} from "@sentience/shared";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      // Required on every write: cross-site pages can't set it without a CORS preflight the server never grants.
      "x-sentience": "1",
      ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new CustomEvent("sentience:unauthorized"));
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
  sleep: { startAt: string; endAt: string }[];
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

export interface SessionRow {
  id: string;
  kind: "browser" | "device";
  name: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string | null;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}
export interface CheckupItem {
  id: string;
  ok: boolean | null;
  title: string;
  detail: string;
  fix?: string;
}

export const api = {
  auth: {
    status: () => get<{ configured: boolean; authenticated: boolean; kind: string | null; https: boolean }>("/auth/status"),
    setup: (code: string, password: string) => post<{ ok: true }>("/auth/setup", { code, password }),
    login: (password: string) => post<{ ok: true }>("/auth/login", { password }),
    logout: () => post<{ ok: true }>("/auth/logout", {}),
    sessions: () => get<SessionRow[]>("/auth/sessions"),
    revoke: (id: string) => del(`/auth/sessions/${id}`),
    addDevice: (name: string) => post<{ id: string; name: string; token: string }>("/auth/devices", { name }),
    changePassword: (current: string, next: string) => put<{ ok: true }>("/auth/password", { current, next }),
  },
  checkup: () => get<{ items: CheckupItem[]; dbKeyConfigured: boolean; tls: boolean }>("/security/checkup"),

  stats: () => get<Stats>("/stats"),
  day: (date: string) => get<DayView>(`/day?date=${date}`),
  overview: (from: string, to: string) => get<Overview>(`/overview?from=${from}&to=${to}`),
  timeline: (from: string, to: string) => get<{ from: string; to: string; timezone: string; days: TimelineDay[] }>(`/timeline?from=${from}&to=${to}`),

  nutrition: (date: string) => get<NutritionDay>(`/nutrition?date=${date}`),
  frequentMeals: () => get<{ title: string; data: Record<string, unknown>; count: number }[]>("/nutrition/frequent"),
  insights: () => get<Insight[]>("/insights"),
  ai: {
    status: () => get<{ enabled: boolean; source: "env" | "settings" | null; model: string }>("/ai/status"),
    setKey: (apiKey: string | null) => put<{ enabled: boolean; source: "env" | "settings" | null; model: string }>("/settings/ai", { apiKey }),
    estimateMeal: (description: string, image?: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }) =>
      post<MealEstimate>("/ai/meal-estimate", { description, image }),
    assess: (from: string, to: string) => post<{ markdown: string; model: string }>("/ai/assess", { from, to }),
  },

  reminders: {
    list: () => get<ReminderStatus[]>("/reminders"),
    doses: (date?: string) => get<ReminderDose[]>(`/reminders/doses${date ? `?date=${date}` : ""}`),
    create: (input: ReminderInput) => post<Reminder>("/reminders", input),
    update: (id: string, input: Partial<ReminderInput>) => put<Reminder>(`/reminders/${id}`, input),
    remove: (id: string) => del(`/reminders/${id}`),
    taken: (id: string, date: string, time: string) => post<Event>(`/reminders/${id}/taken`, { date, time }),
    undo: (id: string, date: string, time: string) => del(`/reminders/${id}/taken?date=${date}&time=${encodeURIComponent(time)}`),
    calendarUrl: "/api/reminders/calendar.ics",
  },

  explore: {
    options: (from: string, to: string) => get<ExploreOptions>(`/explore/options?from=${from}&to=${to}`),
    discover: (from: string, to: string) => get<ExploreResult[]>(`/explore/discover?from=${from}&to=${to}`),
    run: (q: { from: string; to: string; x: string; y: string; lag: number; after?: number | null }) =>
      get<ExploreResult>(`/explore?from=${q.from}&to=${q.to}&x=${encodeURIComponent(q.x)}&y=${encodeURIComponent(q.y)}&lag=${q.lag}${q.after != null ? `&after=${q.after}` : ""}`),
  },

  labs: {
    list: () => get<LabResult[]>("/labs"),
    create: (input: LabResultInput) => post<LabResult & { duplicate: boolean }>("/labs", input),
    bulk: (items: LabResultInput[]) => post<{ created: number; duplicates: number }>("/labs/bulk", items),
    update: (id: string, input: Partial<LabResultInput>) => put<LabResult>(`/labs/${id}`, input),
    remove: (id: string) => del(`/labs/${id}`),
    previewPatientAccess: (fileBase64: string) => post<PatientAccessPreview>("/labs/import/patient-access", { fileBase64, commit: false }),
    importPatientAccess: (fileBase64: string) => post<{ created: number; duplicates: number; skipped: number }>("/labs/import/patient-access", { fileBase64, commit: true }),
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

export interface PatientAccessRow extends LabResultInput {
  source: string;
  flag: "low" | "normal" | "high" | "unknown";
  rangeFrom: "report" | "preset" | "none";
  exists: boolean;
}
export interface PatientAccessPreview {
  rows: PatientAccessRow[];
  skipped: { date: string; description: string; reason: string }[];
  reports: number;
  from: string | null;
  to: string | null;
  newCount: number;
}

/** Raw bytes as base64, so the server can sort out the file's real encoding. */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export interface ExploreOptions {
  x: { value: string; label: string; group: string; count: number }[];
  y: { value: string; label: string; count: number; defaultLag: number }[];
}
export interface ExploreResult {
  x: string;
  y: string;
  xLabel: string;
  yLabel: string;
  yUnit: string;
  lag: number;
  kind: "binary" | "numeric";
  points: { date: string; x: number; y: number }[];
  n: number;
  groups: { label: string; n: number; mean: number | null }[];
  diff: number | null;
  diffPct: number | null;
  r: number | null;
  p: number | null;
  verdict: "likely" | "possible" | "none" | "not-enough";
  summary: string;
}
