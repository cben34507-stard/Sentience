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
  { label: string; hint: string }
> = {
  meal: { label: "Meal", hint: "What did you eat, roughly how much" },
  drink: { label: "Drink", hint: "Water, coffee, alcohol…" },
  supplement: { label: "Supplement", hint: "Vitamins and supplements" },
  medication: { label: "Medication", hint: "Prescribed or over-the-counter" },
  hygiene: { label: "Hygiene", hint: "Teeth, shower, skincare" },
  sleep: { label: "Sleep", hint: "Went to bed / naps" },
  wake: { label: "Wake", hint: "Got up for the day" },
  movement: { label: "Movement", hint: "Walks, commutes, left/returned home" },
  workout: { label: "Workout", hint: "Training sessions" },
  work: { label: "Work", hint: "Focused work blocks" },
  study: { label: "Study", hint: "Learning" },
  social: { label: "Social", hint: "Time with people" },
  leisure: { label: "Leisure", hint: "Downtime, screens, hobbies" },
  mood: { label: "Mood", hint: "How you felt, 1–10" },
  symptom: { label: "Symptom", hint: "Headache, fatigue, pain…" },
  location: { label: "Location", hint: "Where you were" },
  chore: { label: "Chore", hint: "Errands and housework" },
  note: { label: "Note", hint: "Anything else" },
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
  /** Daily nutrition targets for the Food page. */
  calorieTarget: z.number().int().positive().max(10000).optional().nullable(),
  proteinTargetG: z.number().int().positive().max(1000).optional().nullable(),
  waterTargetMl: z.number().int().positive().max(10000).optional().nullable(),
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
  HKQuantityTypeIdentifierDietaryEnergyConsumed: { label: "Calories eaten", unit: "kcal", short: "Eaten" },
  HKQuantityTypeIdentifierDietaryProtein: { label: "Protein", unit: "g", short: "Protein" },
  HKQuantityTypeIdentifierDietaryCarbohydrates: { label: "Carbohydrates", unit: "g", short: "Carbs" },
  HKQuantityTypeIdentifierDietaryFatTotal: { label: "Fat", unit: "g", short: "Fat" },
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
/* Nutrition — meals and water are timeline events with numbers in data */
/* ------------------------------------------------------------------ */

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Fields stored in a meal event's `data`. */
export const MealDataSchema = z.object({
  slot: z.enum(MEAL_SLOTS).optional(),
  portion: z.string().max(200).optional(),
  kcal: z.number().nonnegative().optional(),
  protein_g: z.number().nonnegative().optional(),
  carbs_g: z.number().nonnegative().optional(),
  fat_g: z.number().nonnegative().optional(),
  fibre_g: z.number().nonnegative().optional(),
  /** True when the numbers came from an AI estimate. */
  estimated: z.boolean().optional(),
});
export type MealData = z.infer<typeof MealDataSchema>;

export const MealEstimateSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      portion: z.string(),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      fibre_g: z.number(),
    }),
  ),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string(),
});
export type MealEstimate = z.infer<typeof MealEstimateSchema>;

export interface NutritionDay {
  date: string;
  meals: Event[];
  water: Event[];
  totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fibre_g: number; water_ml: number };
  /** What Apple Health recorded that day (e.g. synced from MyFitnessPal). Not added to totals. */
  appleHealth: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; water_ml: number | null };
  targets: { kcal: number | null; protein_g: number | null; water_ml: number | null };
}

/* ------------------------------------------------------------------ */
/* Insights — plain-language findings computed locally                  */
/* ------------------------------------------------------------------ */

export interface Insight {
  id: string;
  tone: "good" | "watch" | "info";
  title: string;
  detail: string;
  area: "heart" | "sleep" | "activity" | "nutrition" | "tests" | "mood";
}

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
/* Test results — bloods and other measurements from the doctor        */
/* ------------------------------------------------------------------ */

export const LabResultSchema = z.object({
  id,
  /** Preset key from LAB_TESTS, or "custom". */
  testKey: z.string().min(1).max(60),
  /** Display name, e.g. "Vitamin D (25-OH)". */
  name: z.string().min(1).max(200),
  /** Panel or report grouping, e.g. "Lipids", "Full blood count". */
  panel: z.string().max(120).default(""),
  value: z.number().nullable(),
  /** For non-numeric results such as "negative" or "<0.5". */
  valueText: z.string().max(200).nullable().optional(),
  unit: z.string().max(40).default(""),
  refLow: z.number().nullable().optional(),
  refHigh: z.number().nullable().optional(),
  /** When the sample was taken. */
  takenAt: isoDateTime,
  /** GP surgery, hospital, private lab. */
  lab: z.string().max(200).default(""),
  notes: z.string().max(2000).default(""),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional().nullable(),
});
export type LabResult = z.infer<typeof LabResultSchema>;
export const LabResultInputSchema = LabResultSchema.omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true }).partial({
  panel: true,
  valueText: true,
  unit: true,
  refLow: true,
  refHigh: true,
  lab: true,
  notes: true,
});
export type LabResultInput = z.infer<typeof LabResultInputSchema>;

export type LabFlag = "low" | "normal" | "high" | "unknown";
export function labFlag(r: Pick<LabResult, "value" | "refLow" | "refHigh">): LabFlag {
  if (r.value == null || (r.refLow == null && r.refHigh == null)) return "unknown";
  if (r.refLow != null && r.value < r.refLow) return "low";
  if (r.refHigh != null && r.value > r.refHigh) return "high";
  return "normal";
}

export interface LabTestPreset {
  key: string;
  name: string;
  panel: string;
  unit: string;
  /**
   * Typical UK adult range (Pathology Harmony where it exists, otherwise NICE/NHS
   * thresholds or common NHS lab ranges). These are for adult men unless `female`
   * overrides them. Labs differ, so an imported or entered report range wins.
   */
  refLow?: number;
  refHigh?: number;
  /** Range for women where it differs. */
  female?: { refLow?: number; refHigh?: number };
  /**
   * HealthKit quantity type the iPhone app writes this result to.
   * Apple Health keeps lab panels as read-only clinical records, so only
   * results with a matching HealthKit type can be shared over.
   */
  healthKit?: { type: string; unit: string };
}

export const LAB_TESTS: LabTestPreset[] = [
  // Diabetes & glucose
  { key: "hba1c", name: "HbA1c", panel: "Diabetes", unit: "mmol/mol", refHigh: 41 },
  { key: "glucose_fasting", name: "Glucose (fasting)", panel: "Diabetes", unit: "mmol/L", refLow: 3.5, refHigh: 6.0, healthKit: { type: "HKQuantityTypeIdentifierBloodGlucose", unit: "mmol<180.15588000005408>/L" } },
  { key: "glucose_random", name: "Glucose (random)", panel: "Diabetes", unit: "mmol/L", refLow: 3.5, refHigh: 7.8, healthKit: { type: "HKQuantityTypeIdentifierBloodGlucose", unit: "mmol<180.15588000005408>/L" } },
  // Lipids
  { key: "chol_total", name: "Total cholesterol", panel: "Lipids", unit: "mmol/L", refHigh: 5.0 },
  { key: "ldl", name: "LDL cholesterol", panel: "Lipids", unit: "mmol/L", refHigh: 3.0 },
  { key: "hdl", name: "HDL cholesterol", panel: "Lipids", unit: "mmol/L", refLow: 1.0, female: { refLow: 1.2 } },
  { key: "non_hdl", name: "Non-HDL cholesterol", panel: "Lipids", unit: "mmol/L", refHigh: 4.0 },
  { key: "triglycerides", name: "Triglycerides", panel: "Lipids", unit: "mmol/L", refHigh: 1.7 },
  { key: "chol_hdl_ratio", name: "Cholesterol : HDL ratio", panel: "Lipids", unit: "ratio", refHigh: 4.0 },
  // Vitamins & iron
  { key: "vitd", name: "Vitamin D (25-OH)", panel: "Vitamins & iron", unit: "nmol/L", refLow: 50, refHigh: 150 },
  { key: "b12", name: "Vitamin B12", panel: "Vitamins & iron", unit: "ng/L", refLow: 200, refHigh: 900 },
  { key: "folate", name: "Folate (serum)", panel: "Vitamins & iron", unit: "µg/L", refLow: 3, refHigh: 20 },
  { key: "ferritin", name: "Ferritin", panel: "Vitamins & iron", unit: "µg/L", refLow: 30, refHigh: 400, female: { refLow: 30, refHigh: 200 } },
  { key: "iron", name: "Iron (serum)", panel: "Vitamins & iron", unit: "µmol/L", refLow: 10, refHigh: 30 },
  { key: "tsat", name: "Transferrin saturation", panel: "Vitamins & iron", unit: "%", refLow: 20, refHigh: 50 },
  // Full blood count
  { key: "hb", name: "Haemoglobin", panel: "Full blood count", unit: "g/L", refLow: 130, refHigh: 180, female: { refLow: 115, refHigh: 165 } },
  { key: "rbc", name: "Red cell count", panel: "Full blood count", unit: "×10¹²/L", refLow: 4.5, refHigh: 6.5, female: { refLow: 3.8, refHigh: 5.8 } },
  { key: "hct", name: "Haematocrit", panel: "Full blood count", unit: "L/L", refLow: 0.4, refHigh: 0.52, female: { refLow: 0.37, refHigh: 0.47 } },
  { key: "wbc", name: "White cell count", panel: "Full blood count", unit: "×10⁹/L", refLow: 4.0, refHigh: 11.0 },
  { key: "platelets", name: "Platelets", panel: "Full blood count", unit: "×10⁹/L", refLow: 150, refHigh: 400 },
  { key: "mcv", name: "MCV", panel: "Full blood count", unit: "fL", refLow: 80, refHigh: 100 },
  { key: "mch", name: "MCH", panel: "Full blood count", unit: "pg", refLow: 27, refHigh: 32 },
  { key: "mchc", name: "MCHC", panel: "Full blood count", unit: "g/L", refLow: 320, refHigh: 360 },
  { key: "rdw", name: "RDW", panel: "Full blood count", unit: "%", refLow: 11.5, refHigh: 15 },
  { key: "neutrophils", name: "Neutrophils", panel: "Full blood count", unit: "×10⁹/L", refLow: 2.0, refHigh: 7.5 },
  { key: "lymphocytes", name: "Lymphocytes", panel: "Full blood count", unit: "×10⁹/L", refLow: 1.0, refHigh: 4.0 },
  { key: "monocytes", name: "Monocytes", panel: "Full blood count", unit: "×10⁹/L", refLow: 0.2, refHigh: 0.8 },
  { key: "eosinophils", name: "Eosinophils", panel: "Full blood count", unit: "×10⁹/L", refLow: 0, refHigh: 0.4 },
  { key: "basophils", name: "Basophils", panel: "Full blood count", unit: "×10⁹/L", refLow: 0, refHigh: 0.1 },
  // Thyroid
  { key: "tsh", name: "TSH", panel: "Thyroid", unit: "mU/L", refLow: 0.27, refHigh: 4.2 },
  { key: "ft4", name: "Free T4", panel: "Thyroid", unit: "pmol/L", refLow: 12, refHigh: 22 },
  { key: "ft3", name: "Free T3", panel: "Thyroid", unit: "pmol/L", refLow: 3.1, refHigh: 6.8 },
  // Liver
  { key: "alt", name: "ALT", panel: "Liver", unit: "U/L", refHigh: 40 },
  { key: "ast", name: "AST", panel: "Liver", unit: "U/L", refHigh: 40 },
  { key: "alp", name: "ALP", panel: "Liver", unit: "U/L", refLow: 30, refHigh: 130 },
  { key: "ggt", name: "GGT", panel: "Liver", unit: "U/L", refHigh: 55 },
  { key: "bilirubin", name: "Bilirubin", panel: "Liver", unit: "µmol/L", refHigh: 21 },
  { key: "albumin", name: "Albumin", panel: "Liver", unit: "g/L", refLow: 35, refHigh: 50 },
  { key: "total_protein", name: "Total protein", panel: "Liver", unit: "g/L", refLow: 60, refHigh: 80 },
  { key: "globulin", name: "Globulin", panel: "Liver", unit: "g/L", refLow: 20, refHigh: 35 },
  { key: "fib4", name: "FIB-4 score", panel: "Liver", unit: "score", refHigh: 1.3 },
  // Kidney & electrolytes
  { key: "creatinine", name: "Creatinine", panel: "Kidney", unit: "µmol/L", refLow: 59, refHigh: 104, female: { refLow: 45, refHigh: 84 } },
  { key: "egfr", name: "eGFR", panel: "Kidney", unit: "mL/min/1.73m²", refLow: 60 },
  { key: "urea", name: "Urea", panel: "Kidney", unit: "mmol/L", refLow: 2.5, refHigh: 7.8 },
  { key: "sodium", name: "Sodium", panel: "Kidney", unit: "mmol/L", refLow: 133, refHigh: 146 },
  { key: "potassium", name: "Potassium", panel: "Kidney", unit: "mmol/L", refLow: 3.5, refHigh: 5.3 },
  { key: "calcium_adj", name: "Calcium (adjusted)", panel: "Bone", unit: "mmol/L", refLow: 2.2, refHigh: 2.6 },
  { key: "magnesium", name: "Magnesium", panel: "Bone", unit: "mmol/L", refLow: 0.7, refHigh: 1.0 },
  { key: "calcium", name: "Calcium (total)", panel: "Bone", unit: "mmol/L", refLow: 2.2, refHigh: 2.6 },
  { key: "phosphate", name: "Phosphate", panel: "Bone", unit: "mmol/L", refLow: 0.8, refHigh: 1.5 },
  { key: "urate", name: "Uric acid", panel: "Kidney", unit: "µmol/L", refLow: 200, refHigh: 430, female: { refLow: 140, refHigh: 360 } },
  // Inflammation & hormones
  { key: "crp", name: "CRP", panel: "Inflammation", unit: "mg/L", refHigh: 5 },
  { key: "esr", name: "ESR", panel: "Inflammation", unit: "mm/hr", refHigh: 20 },
  { key: "testosterone", name: "Testosterone (total)", panel: "Hormones", unit: "nmol/L", refLow: 8.6, refHigh: 29, female: { refLow: 0.29, refHigh: 1.67 } },
  { key: "free_testosterone", name: "Free testosterone (calculated)", panel: "Hormones", unit: "nmol/L", refLow: 0.225, refHigh: 0.62 },
  { key: "shbg", name: "SHBG", panel: "Hormones", unit: "nmol/L", refLow: 18, refHigh: 54, female: { refLow: 26, refHigh: 110 } },
  { key: "lh", name: "LH", panel: "Hormones", unit: "IU/L", refLow: 1.7, refHigh: 8.6 },
  { key: "fsh", name: "FSH", panel: "Hormones", unit: "IU/L", refLow: 1.5, refHigh: 12.4 },
  { key: "prolactin", name: "Prolactin", panel: "Hormones", unit: "mU/L", refLow: 86, refHigh: 324, female: { refLow: 102, refHigh: 496 } },
  { key: "cortisol_am", name: "Cortisol (morning)", panel: "Hormones", unit: "nmol/L" },
  { key: "psa", name: "PSA", panel: "Hormones", unit: "µg/L", refHigh: 3 },
  // Measurements that Apple Health has a home for
  { key: "bp_sys", name: "Blood pressure (systolic)", panel: "Clinic measurements", unit: "mmHg", refLow: 90, refHigh: 139, healthKit: { type: "HKQuantityTypeIdentifierBloodPressureSystolic", unit: "mmHg" } },
  { key: "bp_dia", name: "Blood pressure (diastolic)", panel: "Clinic measurements", unit: "mmHg", refLow: 60, refHigh: 89, healthKit: { type: "HKQuantityTypeIdentifierBloodPressureDiastolic", unit: "mmHg" } },
  { key: "bp_sys_home", name: "Home BP average (systolic)", panel: "Clinic measurements", unit: "mmHg", refHigh: 134 },
  { key: "bp_dia_home", name: "Home BP average (diastolic)", panel: "Clinic measurements", unit: "mmHg", refHigh: 84 },
  { key: "spo2", name: "Oxygen saturation", panel: "Clinic measurements", unit: "%", refLow: 95, healthKit: { type: "HKQuantityTypeIdentifierOxygenSaturation", unit: "%" } },
  { key: "temp", name: "Body temperature", panel: "Clinic measurements", unit: "°C", refLow: 36.0, refHigh: 37.9, healthKit: { type: "HKQuantityTypeIdentifierBodyTemperature", unit: "degC" } },
  { key: "pulse", name: "Pulse (resting)", panel: "Clinic measurements", unit: "bpm", refLow: 60, refHigh: 100, healthKit: { type: "HKQuantityTypeIdentifierRestingHeartRate", unit: "count/min" } },
  { key: "height", name: "Height", panel: "Body measurements", unit: "cm" },
  { key: "weight", name: "Weight", panel: "Body measurements", unit: "kg", healthKit: { type: "HKQuantityTypeIdentifierBodyMass", unit: "kg" } },
  { key: "bmi", name: "BMI", panel: "Body measurements", unit: "kg/m²", refLow: 18.5, refHigh: 24.9, healthKit: { type: "HKQuantityTypeIdentifierBodyMassIndex", unit: "count" } },
  { key: "body_fat", name: "Body fat", panel: "Body measurements", unit: "%", healthKit: { type: "HKQuantityTypeIdentifierBodyFatPercentage", unit: "%" } },
  { key: "waist", name: "Waist", panel: "Body measurements", unit: "cm", healthKit: { type: "HKQuantityTypeIdentifierWaistCircumference", unit: "cm" } },
  // Tape-measure sites (Apple Health only has a slot for waist)
  { key: "neck", name: "Neck", panel: "Body measurements", unit: "cm" },
  { key: "shoulders", name: "Shoulders", panel: "Body measurements", unit: "cm" },
  { key: "chest", name: "Chest", panel: "Body measurements", unit: "cm" },
  { key: "hips", name: "Hips", panel: "Body measurements", unit: "cm" },
  { key: "bicep_l", name: "Bicep (left)", panel: "Body measurements", unit: "cm" },
  { key: "bicep_r", name: "Bicep (right)", panel: "Body measurements", unit: "cm" },
  { key: "forearm", name: "Forearm", panel: "Body measurements", unit: "cm" },
  { key: "thigh_l", name: "Thigh (left)", panel: "Body measurements", unit: "cm" },
  { key: "thigh_r", name: "Thigh (right)", panel: "Body measurements", unit: "cm" },
  { key: "calf_l", name: "Calf (left)", panel: "Body measurements", unit: "cm" },
  { key: "calf_r", name: "Calf (right)", panel: "Body measurements", unit: "cm" },
  { key: "fev1", name: "FEV1", panel: "Lung function", unit: "L", healthKit: { type: "HKQuantityTypeIdentifierForcedExpiratoryVolume1", unit: "L" } },
  { key: "fvc", name: "FVC", panel: "Lung function", unit: "L", healthKit: { type: "HKQuantityTypeIdentifierForcedVitalCapacity", unit: "L" } },
  { key: "peak_flow", name: "Peak flow", panel: "Lung function", unit: "L/min", healthKit: { type: "HKQuantityTypeIdentifierPeakExpiratoryFlowRate", unit: "L/min" } },
  { key: "fev1_fvc", name: "FEV1/FVC ratio", panel: "Lung function", unit: "ratio", refLow: 0.7 },
  { key: "fev1_pct", name: "FEV1 (% predicted)", panel: "Lung function", unit: "%", refLow: 80 },
  { key: "fvc_pct", name: "FVC (% predicted)", panel: "Lung function", unit: "%", refLow: 80 },
  { key: "lung_age", name: "Spirometric lung age", panel: "Lung function", unit: "years" },
  { key: "act_score", name: "Asthma Control Test", panel: "Lung function", unit: "/25", refLow: 20 },
];

/** Tape-measure sites in the order you'd measure them, top to bottom. */
export const TAPE_SITES = ["neck", "shoulders", "chest", "bicep_l", "bicep_r", "forearm", "waist", "hips", "thigh_l", "thigh_r", "calf_l", "calf_r"] as const;
export const BODY_PANEL = "Body measurements";

export const LAB_TEST_BY_KEY: Record<string, LabTestPreset> = Object.fromEntries(LAB_TESTS.map((t) => [t.key, t]));

/** The preset range for this person's sex (male ranges when unknown). */
export function presetRange(p: LabTestPreset, sex?: string | null): { refLow?: number; refHigh?: number } {
  if (sex === "female" && p.female) return { refLow: p.female.refLow ?? p.refLow, refHigh: p.female.refHigh ?? p.refHigh };
  return { refLow: p.refLow, refHigh: p.refHigh };
}

/* ------------------------------------------------------------------ */
/* Reminders — supplements, medication, habits                          */
/* ------------------------------------------------------------------ */

export const REMINDER_KINDS = ["supplement", "medication", "habit", "other"] as const;
export const ReminderSchema = z.object({
  id,
  title: z.string().trim().min(1).max(120),
  kind: z.enum(REMINDER_KINDS),
  /** SUPPLEMENTS key when the title is a known supplement. */
  supplementKey: z.string().max(60).nullable().default(null),
  dose: z.string().max(80).default(""),
  /** Local times, "HH:MM". */
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(8),
  /** Days of the week it applies, 0 = Sunday. */
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  notes: z.string().max(1000).default(""),
  active: z.boolean().default(true),
  /** First day taken; the supplement timeline counts from here. */
  startedOn: isoDate,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.nullable().optional(),
});
export type Reminder = z.infer<typeof ReminderSchema>;
export const ReminderInputSchema = ReminderSchema.omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export type ReminderInput = z.input<typeof ReminderInputSchema>;

export interface ReminderDose {
  reminderId: string;
  title: string;
  dose: string;
  kind: Reminder["kind"];
  time: string;
  /** ISO instant the dose is due. */
  dueAt: string;
  status: "taken" | "due" | "upcoming" | "missed";
  /** Timeline event that recorded it, when taken. */
  eventId: string | null;
  takenAt: string | null;
}
export interface ReminderStatus extends Reminder {
  /** Share of scheduled doses taken over the last 30 days (or since starting). */
  adherence: number | null;
  scheduled30: number;
  taken30: number;
  /** Days in a row with every dose taken, up to today. */
  streak: number;
  daysSinceStart: number;
}

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
  labResults: z.array(LabResultSchema),
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
  labResults: z.array(LabResultSchema).default([]),
  healthSamples: z.array(HealthSampleSchema.extend({ categoryValue: z.string().nullable().optional() })).default([]),
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
  labResults: z.array(LabResultSchema),
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

export * from "./labInfo.js";
export * from "./supplements.js";
