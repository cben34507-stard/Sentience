import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const isoDateTime = z.string().datetime({ offset: true });
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
export const id = z.string().min(1);

/* ------------------------------------------------------------------ */
/* Events — anything that happens on a day's timeline                  */
/* ------------------------------------------------------------------ */

export const EVENT_CATEGORIES = [
  "meal",
  "drink",
  "supplement",
  "medication",
  "hygiene",
  "sleep",
  "wake",
  "movement",
  "workout",
  "work",
  "study",
  "social",
  "leisure",
  "mood",
  "symptom",
  "location",
  "chore",
  "note",
] as const;
export const EventCategory = z.enum(EVENT_CATEGORIES);
export type EventCategory = z.infer<typeof EventCategory>;

export const EVENT_CATEGORY_META: Record<
  EventCategory,
  { label: string; icon: string; hint: string }
> = {
  meal: { label: "Meal", icon: "🍽️", hint: "What did you eat, roughly how much" },
  drink: { label: "Drink", icon: "🥤", hint: "Water, coffee, alcohol…" },
  supplement: { label: "Supplement", icon: "💊", hint: "Vitamins and supplements" },
  medication: { label: "Medication", icon: "🩺", hint: "Prescribed or over-the-counter" },
  hygiene: { label: "Hygiene", icon: "🪥", hint: "Teeth, shower, skincare" },
  sleep: { label: "Sleep", icon: "🌙", hint: "Went to bed / naps" },
  wake: { label: "Wake", icon: "☀️", hint: "Got up for the day" },
  movement: { label: "Movement", icon: "🚶", hint: "Walks, commutes, left/returned home" },
  workout: { label: "Workout", icon: "🏋️", hint: "Training sessions" },
  work: { label: "Work", icon: "💼", hint: "Focused work blocks" },
  study: { label: "Study", icon: "📚", hint: "Learning" },
  social: { label: "Social", icon: "👥", hint: "Time with people" },
  leisure: { label: "Leisure", icon: "🎮", hint: "Downtime, screens, hobbies" },
  mood: { label: "Mood", icon: "🧠", hint: "How you felt, 1–10" },
  symptom: { label: "Symptom", icon: "🤒", hint: "Headache, fatigue, pain…" },
  location: { label: "Location", icon: "📍", hint: "Where you were" },
  chore: { label: "Chore", icon: "🧺", hint: "Errands and housework" },
  note: { label: "Note", icon: "📝", hint: "Anything else" },
};

export const EventSchema = z.object({
  id,
  category: EventCategory,
  title: z.string().min(1).max(200),
  notes: z.string().max(5000).optional().nullable(),
  /** Start instant (ISO 8601 with offset). */
  startAt: isoDateTime,
  /** End instant for ranged events (workouts, work blocks, sleep). */
  endAt: isoDateTime.optional().nullable(),
  /** Free-form tags, e.g. ["protein", "home-cooked"]. */
  tags: z.array(z.string().max(40)).default([]),
  /** Numeric rating where it makes sense (mood 1–10, meal satiety…). */
  rating: z.number().min(0).max(10).optional().nullable(),
  /** Structured extras: { calories: 620, items: ["eggs","toast"] }. */
  data: z.record(z.unknown()).default({}),
  source: z.enum(["web", "ios", "import", "api"]).default("web"),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional().nullable(),
});
export type Event = z.infer<typeof EventSchema>;

export const EventInputSchema = EventSchema.pick({
  category: true,
  title: true,
  notes: true,
  startAt: true,
  endAt: true,
  tags: true,
  rating: true,
  data: true,
  source: true,
}).partial({ tags: true, data: true, source: true, notes: true, endAt: true, rating: true });
export type EventInput = z.infer<typeof EventInputSchema>;

/* ------------------------------------------------------------------ */
/* Profile — who you are, plus an open-ended fact record               */
/* ------------------------------------------------------------------ */

export const ProfileSchema = z.object({
  name: z.string().max(120).default(""),
  dateOfBirth: isoDate.optional().nullable(),
  sex: z.enum(["male", "female", "intersex", "unspecified"]).default("unspecified"),
  heightCm: z.number().positive().max(300).optional().nullable(),
  weightKg: z.number().positive().max(700).optional().nullable(),
  timezone: z.string().default("UTC"),
  /** Anything you want an analyst to know up front. */
  bio: z.string().max(5000).default(""),
  updatedAt: isoDateTime,
});
export type Profile = z.infer<typeof ProfileSchema>;
export const ProfileInputSchema = ProfileSchema.omit({ updatedAt: true }).partial();
export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export const FACT_KINDS = [
  "condition",
  "medication",
  "allergy",
  "genetic",
  "lab",
  "measurement",
  "preference",
  "history",
  "other",
] as const;
export const FactKind = z.enum(FACT_KINDS);
export type FactKind = z.infer<typeof FactKind>;

export const FACT_KIND_META: Record<FactKind, { label: string; hint: string }> = {
  condition: { label: "Condition", hint: "Diagnoses, mental and physical" },
  medication: { label: "Medication", hint: "Ongoing prescriptions, dose, timing" },
  allergy: { label: "Allergy / intolerance", hint: "Food, drug, environmental" },
  genetic: { label: "Genetic marker", hint: "23andMe SNPs: rsID → genotype, e.g. rs4680 → AA" },
  lab: { label: "Lab result", hint: "Bloodwork with date and reference range" },
  measurement: { label: "Measurement", hint: "Body fat %, resting HR baseline, VO2max" },
  preference: { label: "Preference", hint: "Diet style, chronotype, caffeine tolerance" },
  history: { label: "History", hint: "Injuries, surgeries, family history" },
  other: { label: "Other", hint: "Anything else worth knowing" },
};

export const FactSchema = z.object({
  id,
  kind: FactKind,
  /** e.g. "ADHD", "rs4680", "Vitamin D" */
  key: z.string().min(1).max(200),
  /** e.g. "Diagnosed 2019, on methylphenidate", "AA (slow COMT)", "52 nmol/L" */
  value: z.string().max(5000),
  /** Optional: where this came from — "23andMe raw export", "GP letter". */
  source: z.string().max(200).optional().nullable(),
  recordedOn: isoDate.optional().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional().nullable(),
});
export type Fact = z.infer<typeof FactSchema>;
export const FactInputSchema = FactSchema.pick({
  kind: true,
  key: true,
  value: true,
  source: true,
  recordedOn: true,
});
export type FactInput = z.infer<typeof FactInputSchema>;

/* ------------------------------------------------------------------ */
/* Health — Apple Health samples and workouts                          */
/* ------------------------------------------------------------------ */

export const HealthSampleSchema = z.object({
  id,
  /** Apple identifier, e.g. "HKQuantityTypeIdentifierHeartRate". */
  type: z.string(),
  startAt: isoDateTime,
  endAt: isoDateTime,
  value: z.number(),
  unit: z.string().default(""),
  sourceName: z.string().default(""),
  device: z.string().optional().nullable(),
});
export type HealthSample = z.infer<typeof HealthSampleSchema>;

export const HealthWorkoutSchema = z.object({
  id,
  activityType: z.string(),
  startAt: isoDateTime,
  endAt: isoDateTime,
  durationMin: z.number(),
  energyKcal: z.number().optional().nullable(),
  distanceKm: z.number().optional().nullable(),
  sourceName: z.string().default(""),
});
export type HealthWorkout = z.infer<typeof HealthWorkoutSchema>;

/** Friendly names for the Apple types we care about most. */
export const HEALTH_TYPE_META: Record<string, { label: string; unit: string; short: string }> = {
  HKQuantityTypeIdentifierHeartRate: { label: "Heart rate", unit: "bpm", short: "HR" },
  HKQuantityTypeIdentifierRestingHeartRate: { label: "Resting heart rate", unit: "bpm", short: "RHR" },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { label: "HRV (SDNN)", unit: "ms", short: "HRV" },
  HKQuantityTypeIdentifierStepCount: { label: "Steps", unit: "count", short: "Steps" },
  HKQuantityTypeIdentifierDistanceWalkingRunning: { label: "Walking + running distance", unit: "km", short: "Dist" },
  HKQuantityTypeIdentifierActiveEnergyBurned: { label: "Active energy", unit: "kcal", short: "Active" },
  HKQuantityTypeIdentifierBasalEnergyBurned: { label: "Resting energy", unit: "kcal", short: "Basal" },
  HKQuantityTypeIdentifierOxygenSaturation: { label: "Blood oxygen", unit: "%", short: "SpO₂" },
  HKQuantityTypeIdentifierRespiratoryRate: { label: "Respiratory rate", unit: "br/min", short: "Resp" },
  HKQuantityTypeIdentifierBodyMass: { label: "Weight", unit: "kg", short: "Weight" },
  HKQuantityTypeIdentifierBodyFatPercentage: { label: "Body fat", unit: "%", short: "BF" },
  HKQuantityTypeIdentifierVO2Max: { label: "VO₂ max", unit: "mL/kg/min", short: "VO₂" },
  HKQuantityTypeIdentifierAppleExerciseTime: { label: "Exercise minutes", unit: "min", short: "Exercise" },
  HKQuantityTypeIdentifierAppleStandTime: { label: "Stand minutes", unit: "min", short: "Stand" },
  HKQuantityTypeIdentifierFlightsClimbed: { label: "Flights climbed", unit: "count", short: "Flights" },
  HKQuantityTypeIdentifierWalkingHeartRateAverage: { label: "Walking HR average", unit: "bpm", short: "Walk HR" },
  HKQuantityTypeIdentifierEnvironmentalAudioExposure: { label: "Environmental sound", unit: "dBASPL", short: "Noise" },
  HKQuantityTypeIdentifierDietaryWater: { label: "Water", unit: "mL", short: "Water" },
  HKQuantityTypeIdentifierDietaryCaffeine: { label: "Caffeine", unit: "mg", short: "Caffeine" },
  HKCategoryTypeIdentifierSleepAnalysis: { label: "Sleep", unit: "min", short: "Sleep" },
  HKCategoryTypeIdentifierMindfulSession: { label: "Mindful minutes", unit: "min", short: "Mindful" },
};

/** Per-day health rollup used on the timeline and in exports. */
export const DailyHealthSummarySchema = z.object({
  date: isoDate,
  steps: z.number().nullable(),
  distanceKm: z.number().nullable(),
  activeKcal: z.number().nullable(),
  exerciseMin: z.number().nullable(),
  restingHr: z.number().nullable(),
  hrMin: z.number().nullable(),
  hrMax: z.number().nullable(),
  hrAvg: z.number().nullable(),
  hrvAvg: z.number().nullable(),
  sleepMin: z.number().nullable(),
  spo2Avg: z.number().nullable(),
  weightKg: z.number().nullable(),
  workouts: z.array(HealthWorkoutSchema),
});
export type DailyHealthSummary = z.infer<typeof DailyHealthSummarySchema>;

/* ------------------------------------------------------------------ */
/* Goals & achievements                                                */
/* ------------------------------------------------------------------ */

export const GOAL_CADENCES = ["daily", "weekly", "monthly", "once"] as const;
export const GoalCadence = z.enum(GOAL_CADENCES);
export type GoalCadence = z.infer<typeof GoalCadence>;

export const GoalSchema = z.object({
  id,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  cadence: GoalCadence,
  /** Target per cadence period, e.g. 8000 steps, 3 workouts, 2 L water. */
  target: z.number().positive(),
  unit: z.string().max(40).default(""),
  /**
   * How progress is measured. "manual" → you log progress.
   * "events:<category>" → count of events in that category per period.
   * "health:<HKType>" → sum (or avg for HR types) of health samples per period.
   */
  metric: z.string().default("manual"),
  color: z.string().max(20).default("blue"),
  startsOn: isoDate,
  endsOn: isoDate.optional().nullable(),
  archived: z.boolean().default(false),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional().nullable(),
});
export type Goal = z.infer<typeof GoalSchema>;
export const GoalInputSchema = GoalSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).partial({ description: true, unit: true, metric: true, color: true, archived: true, endsOn: true });
export type GoalInput = z.infer<typeof GoalInputSchema>;

export const GoalProgressSchema = z.object({
  id,
  goalId: id,
  date: isoDate,
  amount: z.number(),
  note: z.string().max(500).optional().nullable(),
  createdAt: isoDateTime,
});
export type GoalProgress = z.infer<typeof GoalProgressSchema>;

export const GoalStatusSchema = z.object({
  goal: GoalSchema,
  periodStart: isoDate,
  periodEnd: isoDate,
  current: z.number(),
  target: z.number(),
  percent: z.number(),
  streak: z.number(),
  complete: z.boolean(),
});
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const AchievementSchema = z.object({
  id,
  code: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  unlockedAt: isoDateTime.nullable(),
  progress: z.number().min(0).max(1),
});
export type Achievement = z.infer<typeof AchievementSchema>;

/* ------------------------------------------------------------------ */
/* Export bundle — the thing you hand to an analyst (human or AI)      */
/* ------------------------------------------------------------------ */

export const ExportBundleSchema = z.object({
  app: z.literal("sentience"),
  version: z.literal(1),
  generatedAt: isoDateTime,
  range: z.object({ from: isoDate, to: isoDate, days: z.number() }),
  profile: ProfileSchema,
  facts: z.array(FactSchema),
  goals: z.array(GoalStatusSchema),
  days: z.array(
    z.object({
      date: isoDate,
      events: z.array(EventSchema),
      health: DailyHealthSummarySchema.nullable(),
      /** Hourly heart-rate averages, index 0–23, null where no data. */
      heartRateByHour: z.array(z.number().nullable()),
      stepsByHour: z.array(z.number().nullable()),
    }),
  ),
});
export type ExportBundle = z.infer<typeof ExportBundleSchema>;

/* ------------------------------------------------------------------ */
/* Sync protocol (iOS ⇄ server)                                         */
/* ------------------------------------------------------------------ */

export const SyncPushSchema = z.object({
  deviceId: z.string().min(1),
  /** Server cursor the device last saw; 0 for a fresh install. */
  since: z.number().int().nonnegative().default(0),
  events: z.array(EventSchema).default([]),
  goals: z.array(GoalSchema).default([]),
  goalProgress: z.array(GoalProgressSchema).default([]),
  facts: z.array(FactSchema).default([]),
  healthSamples: z.array(HealthSampleSchema).default([]),
  healthWorkouts: z.array(HealthWorkoutSchema).default([]),
});
export type SyncPush = z.infer<typeof SyncPushSchema>;

export const SyncPullSchema = z.object({
  cursor: z.number().int(),
  serverTime: isoDateTime,
  events: z.array(EventSchema),
  goals: z.array(GoalSchema),
  goalProgress: z.array(GoalProgressSchema),
  facts: z.array(FactSchema),
  profile: ProfileSchema,
});
export type SyncPull = z.infer<typeof SyncPullSchema>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function nowIso(): string {
  return new Date().toISOString();
}

/** Returns YYYY-MM-DD for an instant in the given IANA timezone. */
export function localDate(instant: string | Date, timeZone: string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Returns 0–23 hour for an instant in the given timezone. */
export function localHour(instant: string | Date, timeZone: string): number {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(d);
  return Number(h) % 24;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
