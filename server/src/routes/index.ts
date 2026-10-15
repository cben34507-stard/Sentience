import { Router } from "express";
import multer from "multer";
import path from "node:path";
import {
  EventInputSchema,
  FactInputSchema,
  GoalInputSchema,
  LabResultInputSchema,
  ReminderInputSchema,
  ProfileInputSchema,
  SyncPushSchema,
  isoDate,
  addDays,
} from "@sentience/shared";
import { z } from "zod";
import type { DB } from "../lib/db.js";
import { HttpError, parse, wrap } from "../lib/http.js";
import { dayRange, todayIn } from "../lib/time.js";
import * as profile from "../services/profile.js";
import * as events from "../services/events.js";
import * as health from "../services/health.js";
import * as healthImport from "../services/healthImport.js";
import * as goals from "../services/goals.js";
import { computeAchievements, loggingStreak } from "../services/achievements.js";
import { buildBundle, bundleToMarkdown } from "../services/exportBundle.js";
import { sync } from "../services/sync.js";
import * as labs from "../services/labs.js";
import * as patientAccess from "../services/patientAccess.js";
import * as explore from "../services/explore.js";
import * as reminders from "../services/reminders.js";
import { frequentMeals, nutritionForDay } from "../services/nutrition.js";
import { computeInsights } from "../services/insights.js";
import { aiStatus, assessRange, estimateMeal } from "../services/ai.js";
import { setSetting } from "../services/settings.js";

const DateQuery = z.object({ date: isoDate.optional() });
const RangeQuery = z.object({ from: isoDate, to: isoDate });

export function buildRouter(db: DB, uploadDir: string): Router {
  const r = Router();
  const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 ** 3 } });
  const tz = () => profile.getTimezone(db);

  r.get("/health-check", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  /* ---------- profile & facts ---------- */
  r.get("/profile", wrap(() => profile.getProfile(db)));
  r.put("/profile", wrap((req) => profile.updateProfile(db, parse(ProfileInputSchema, req.body))));

  r.get("/facts", wrap((req) => profile.listFacts(db, typeof req.query.kind === "string" ? req.query.kind : undefined)));
  r.post("/facts", wrap((req, res) => {
    res.status(201);
    return profile.createFact(db, parse(FactInputSchema, req.body));
  }));
  r.post("/facts/bulk", wrap((req, res) => {
    const items = parse(z.array(FactInputSchema).max(5000), req.body);
    const created = db.transaction(() => items.map((i) => profile.createFact(db, i)))();
    res.status(201);
    return { created: created.length };
  }));
  r.put("/facts/:id", wrap((req) => {
    const f = profile.updateFact(db, req.params.id, parse(FactInputSchema.partial(), req.body));
    if (!f) throw new HttpError(404, "fact not found");
    return f;
  }));
  r.delete("/facts/:id", wrap((req, res) => {
    if (!profile.deleteFact(db, req.params.id)) throw new HttpError(404, "fact not found");
    res.status(204).end();
  }));

  /* ---------- events ---------- */
  r.get("/events", wrap((req) => {
    const q = req.query as Record<string, string>;
    if (q.date) return events.listEventsForDay(db, parse(isoDate, q.date), tz());
    if (q.from && q.to) {
      const { from, to } = parse(RangeQuery, q);
      return events.listEvents(db, dayRange(from, tz()).start, dayRange(to, tz()).end);
    }
    return events.listEventsForDay(db, todayIn(tz()), tz());
  }));
  r.post("/events", wrap((req, res) => {
    res.status(201);
    return events.createEvent(db, parse(EventInputSchema, req.body));
  }));
  r.get("/events/:id", wrap((req) => {
    const e = events.getEvent(db, req.params.id);
    if (!e) throw new HttpError(404, "event not found");
    return e;
  }));
  r.put("/events/:id", wrap((req) => {
    const e = events.updateEvent(db, req.params.id, parse(EventInputSchema.partial(), req.body));
    if (!e) throw new HttpError(404, "event not found");
    return e;
  }));
  r.delete("/events/:id", wrap((req, res) => {
    if (!events.deleteEvent(db, req.params.id)) throw new HttpError(404, "event not found");
    res.status(204).end();
  }));

  /* ---------- day view: everything the timeline needs in one call ---------- */
  r.get("/day", wrap((req) => {
    const { date = todayIn(tz()) } = parse(DateQuery, req.query);
    const zone = tz();
    return {
      date,
      timezone: zone,
      range: dayRange(date, zone),
      events: events.listEventsForDay(db, date, zone),
      health: health.dailySummary(db, date, zone),
      heartRate: health.seriesForDay(db, health.T.hr, date, zone),
      stepsByHour: health.hourlySeries(db, health.T.steps, date, zone, "sum"),
      goals: goals.allGoalStatuses(db, date, zone),
      labResults: labs.listLabs(db, dayRange(date, zone).start, dayRange(date, zone).end),
      // Sleep touching this calendar day: the night that ended this morning and the one starting tonight.
      sleep: [...health.sleepIntervalsForNight(db, date, zone), ...health.sleepIntervalsForNight(db, addDays(date, 1), zone)].map(([a, b]) => ({
        startAt: new Date(a * 1000).toISOString(),
        endAt: new Date(b * 1000).toISOString(),
      })),
    };
  }));

  /** Multi-day swimlane data: events, merged sleep spans and hourly HR per day. */
  r.get("/timeline", wrap((req) => {
    const { from, to } = parse(RangeQuery, req.query);
    if (addDays(from, 62) < to) throw new HttpError(400, "range too large (max 62 days)");
    const zone = tz();
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const range = dayRange(d, zone);
      days.push({
        date: d,
        range,
        events: events.listEventsForDay(db, d, zone).map((e) => ({ id: e.id, category: e.category, title: e.title, startAt: e.startAt, endAt: e.endAt, rating: e.rating })),
        sleep: health.sleepIntervalsForNight(db, d, zone).map(([s, e]) => ({ startAt: new Date(s * 1000).toISOString(), endAt: new Date(e * 1000).toISOString() })),
        heartRateByHour: health.hourlySeries(db, health.T.hr, d, zone, "avg"),
      });
    }
    return { from, to, timezone: zone, days };
  }));

  /** Lightweight per-day overview for calendar/week strips. */
  r.get("/overview", wrap((req) => {
    const { from, to } = parse(RangeQuery, req.query);
    const zone = tz();
    const out = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const evs = events.listEventsForDay(db, d, zone);
      const h = health.dailySummary(db, d, zone);
      out.push({
        date: d,
        eventCount: evs.length,
        categories: [...new Set(evs.map((e) => e.category))],
        steps: h?.steps ?? null,
        sleepMin: h?.sleepMin ?? null,
        restingHr: h?.restingHr ?? null,
        hrAvg: h?.hrAvg ?? null,
        activeKcal: h?.activeKcal ?? null,
        workouts: h?.workouts.length ?? 0,
        moodAvg: avg(evs.filter((e) => e.category === "mood" && e.rating != null).map((e) => e.rating as number)),
      });
    }
    return { from, to, days: out, streak: loggingStreak(db, zone, todayIn(zone)) };
  }));

  /* ---------- health ---------- */
  r.get("/health/types", wrap(() => health.listTypes(db)));
  r.get("/health/coverage", wrap(() => health.healthCoverage(db)));
  r.get("/health/samples", wrap((req) => {
    const q = parse(z.object({ type: z.string(), date: isoDate.optional(), from: isoDate.optional(), to: isoDate.optional() }), req.query);
    const zone = tz();
    if (q.date) return health.seriesForDay(db, q.type, q.date, zone);
    if (q.from && q.to) return health.listSamples(db, q.type, dayRange(q.from, zone).start, dayRange(q.to, zone).end);
    throw new HttpError(400, "pass date or from+to");
  }));
  r.get("/health/summary", wrap((req) => {
    const { date = todayIn(tz()) } = parse(DateQuery, req.query);
    return health.dailySummary(db, date, tz());
  }));
  r.post("/health/samples", wrap((req, res) => {
    // Direct ingestion (iOS HealthKit or scripts).
    const body = parse(
      z.object({
        samples: z.array(z.object({ type: z.string(), startAt: z.string(), endAt: z.string(), value: z.number(), unit: z.string().default(""), categoryValue: z.string().nullable().optional(), sourceName: z.string().optional() })).default([]),
        workouts: z.array(z.object({ activityType: z.string(), startAt: z.string(), endAt: z.string(), durationMin: z.number(), energyKcal: z.number().nullable().optional(), distanceKm: z.number().nullable().optional(), sourceName: z.string().default("") })).default([]),
      }),
      req.body,
    );
    const added = health.insertSamplesBulk(db, body.samples);
    const addedWorkouts = health.insertWorkoutsBulk(db, body.workouts);
    res.status(201);
    return { added, addedWorkouts };
  }));
  r.post("/health/import", upload.single("file"), wrap((req, res) => {
    const force = req.query.force === "1";
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) throw new HttpError(400, "attach the Apple Health export as form field 'file'");
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".zip", ".xml"].includes(ext)) throw new HttpError(400, "expected export.zip or export.xml");
    res.status(202);
    return healthImport.startImport(db, file.path, file.originalname, force);
  }));
  r.get("/health/import", wrap(() => healthImport.listJobs(db)));
  r.get("/health/import/:id", wrap((req) => {
    const job = healthImport.getJob(db, req.params.id);
    if (!job) throw new HttpError(404, "import not found");
    return job;
  }));

  /* ---------- goals ---------- */
  r.get("/goals", wrap((req) => {
    const { date = todayIn(tz()) } = parse(DateQuery, req.query);
    return goals.allGoalStatuses(db, date, tz(), req.query.archived === "1");
  }));
  r.post("/goals", wrap((req, res) => {
    res.status(201);
    const g = goals.createGoal(db, parse(GoalInputSchema, req.body));
    return goals.goalStatus(db, g, todayIn(tz()), tz());
  }));
  r.put("/goals/:id", wrap((req) => {
    const g = goals.updateGoal(db, req.params.id, parse(GoalInputSchema.partial(), req.body));
    if (!g) throw new HttpError(404, "goal not found");
    return goals.goalStatus(db, g, todayIn(tz()), tz());
  }));
  r.delete("/goals/:id", wrap((req, res) => {
    if (!goals.deleteGoal(db, req.params.id)) throw new HttpError(404, "goal not found");
    res.status(204).end();
  }));
  r.post("/goals/:id/progress", wrap((req, res) => {
    const g = goals.getGoal(db, req.params.id);
    if (!g) throw new HttpError(404, "goal not found");
    const body = parse(z.object({ date: isoDate.optional(), amount: z.number(), note: z.string().optional() }), req.body);
    goals.addProgress(db, g.id, body.date ?? todayIn(tz()), body.amount, body.note);
    res.status(201);
    return goals.goalStatus(db, g, body.date ?? todayIn(tz()), tz());
  }));
  r.get("/goals/:id/progress", wrap((req) => {
    const { from, to } = parse(RangeQuery, req.query);
    return goals.listProgress(db, req.params.id, from, to);
  }));

  /* ---------- test results ---------- */
  r.get("/labs", wrap((req) => {
    const q = req.query as Record<string, string>;
    if (q.from && q.to) {
      const { from, to } = parse(RangeQuery, q);
      return labs.listLabs(db, dayRange(from, tz()).start, dayRange(to, tz()).end);
    }
    return labs.listLabs(db);
  }));
  r.post("/labs", wrap((req, res) => {
    const out = labs.createLab(db, parse(LabResultInputSchema, req.body));
    res.status(out.duplicate ? 200 : 201);
    return { ...out.result, duplicate: out.duplicate };
  }));
  r.post("/labs/bulk", wrap((req, res) => {
    const items = parse(z.array(LabResultInputSchema).min(1).max(200), req.body);
    const results = db.transaction(() => items.map((i) => labs.createLab(db, i)))();
    res.status(201);
    return { created: results.filter((r) => !r.duplicate).length, duplicates: results.filter((r) => r.duplicate).length };
  }));
  /** Patient Access (EMIS) medical record XML. `commit: false` previews without saving. */
  r.post("/labs/import/patient-access", wrap((req, res) => {
    const body = parse(z.object({ fileBase64: z.string().min(1).max(14_000_000), commit: z.boolean().default(false) }), req.body);
    let parsed;
    try {
      parsed = patientAccess.parsePatientAccess(Buffer.from(body.fileBase64, "base64"), tz(), profile.getProfile(db).sex);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Couldn't read that file");
    }
    const inputs = patientAccess.toInputs(parsed.rows);
    if (!body.commit) {
      const existing = inputs.map((i) => !!labs.findDuplicate(db, i));
      return { ...parsed, rows: parsed.rows.map((r, i) => ({ ...r, exists: existing[i] })), newCount: existing.filter((e) => !e).length };
    }
    const results = db.transaction(() => inputs.map((i) => labs.createLab(db, i)))();
    res.status(201);
    return { created: results.filter((r) => !r.duplicate).length, duplicates: results.filter((r) => r.duplicate).length, skipped: parsed.skipped.length };
  }));
  r.put("/labs/:id", wrap((req) => {
    const l = labs.updateLab(db, req.params.id, parse(LabResultInputSchema.partial(), req.body));
    if (!l) throw new HttpError(404, "result not found");
    return l;
  }));
  r.delete("/labs/:id", wrap((req, res) => {
    if (!labs.deleteLab(db, req.params.id)) throw new HttpError(404, "result not found");
    res.status(204).end();
  }));

  /* ---------- nutrition ---------- */
  r.get("/nutrition", wrap((req) => {
    const { date = todayIn(tz()) } = parse(DateQuery, req.query);
    return nutritionForDay(db, date, tz());
  }));
  r.get("/nutrition/frequent", wrap(() => frequentMeals(db)));

  /* ---------- insights (local, no AI) ---------- */
  r.get("/insights", wrap(() => computeInsights(db, tz(), todayIn(tz()))));

  /* ---------- reminders ---------- */
  r.get("/reminders", wrap(() => reminders.reminderStatuses(db, tz(), todayIn(tz()))));
  r.get("/reminders/doses", wrap((req) => {
    const { date } = parse(z.object({ date: isoDate.optional() }), req.query);
    return reminders.dosesForDay(db, date ?? todayIn(tz()), tz());
  }));
  r.get("/reminders/calendar.ics", (_req, res) => {
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="sentience-reminders.ics"');
    res.send(reminders.remindersIcs(db, tz()));
  });
  r.post("/reminders", wrap((req, res) => {
    res.status(201);
    return reminders.createReminder(db, parse(ReminderInputSchema, req.body));
  }));
  r.put("/reminders/:id", wrap((req) => {
    const out = reminders.updateReminder(db, req.params.id, parse(ReminderInputSchema.partial(), req.body));
    if (!out) throw new HttpError(404, "reminder not found");
    return out;
  }));
  r.delete("/reminders/:id", wrap((req, res) => {
    if (!reminders.deleteReminder(db, req.params.id)) throw new HttpError(404, "reminder not found");
    res.status(204).end();
  }));
  const DoseBody = z.object({ date: isoDate, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });
  r.post("/reminders/:id/taken", wrap((req, res) => {
    const { date, time } = parse(DoseBody, req.body);
    if (!reminders.getReminder(db, req.params.id)) throw new HttpError(404, "reminder not found");
    res.status(201);
    return reminders.markTaken(db, req.params.id, date, time, tz());
  }));
  r.delete("/reminders/:id/taken", wrap((req) => {
    const { date, time } = parse(DoseBody, req.query);
    return { removed: reminders.undoTaken(db, req.params.id, date, time, tz()) };
  }));

  /* ---------- does X affect Y? ---------- */
  const exploreRange = (q: unknown) => {
    const { from, to } = parse(RangeQuery, q);
    if (from > to) throw new HttpError(400, "from must be before to");
    if (Date.parse(to) - Date.parse(from) > 366 * 86400_000) throw new HttpError(400, "Pick a year or less");
    return { from, to };
  };
  r.get("/explore/options", wrap((req) => {
    const { from, to } = exploreRange(req.query);
    return explore.options(explore.loadDays(db, tz(), from, to));
  }));
  r.get("/explore/discover", wrap((req) => {
    const { from, to } = exploreRange(req.query);
    return explore.discover(explore.loadDays(db, tz(), from, to), tz());
  }));
  r.get("/explore", wrap((req) => {
    const { from, to } = exploreRange(req.query);
    const q = parse(
      z.object({
        x: z.string().regex(/^(cat|text|title|tag|data|health|rating):.{1,120}$/),
        y: z.string().regex(/^([a-zA-Z]+|rating:[a-z_]+)$/),
        lag: z.coerce.number().int().min(0).max(3).default(1),
        after: z.coerce.number().int().min(0).max(23).optional(),
      }),
      req.query,
    );
    return explore.analyse(explore.loadDays(db, tz(), from, to), { x: q.x, y: q.y, lag: q.lag, afterHour: q.after ?? null }, tz());
  }));

  /* ---------- AI (optional; needs an Anthropic API key) ---------- */
  r.get("/ai/status", wrap(() => aiStatus(db)));
  r.put("/settings/ai", wrap((req) => {
    const { apiKey } = parse(z.object({ apiKey: z.string().trim().min(20).max(400).nullable() }), req.body);
    setSetting(db, "anthropic_api_key", apiKey);
    return aiStatus(db);
  }));
  r.post("/ai/meal-estimate", wrap(async (req) => {
    const body = parse(
      z.object({
        description: z.string().max(2000).default(""),
        image: z.object({ data: z.string().max(12_000_000), mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]) }).optional(),
      }),
      req.body,
    );
    if (!body.description.trim() && !body.image) throw new HttpError(400, "Describe the meal or add a photo");
    return estimateMeal(db, body);
  }));
  r.post("/ai/assess", wrap(async (req) => {
    const { from, to } = parse(RangeQuery, req.body);
    if (addDays(from, 31) < to) throw new HttpError(400, "Pick 31 days or fewer for an AI assessment");
    return assessRange(db, bundleToMarkdown(buildBundle(db, from, to)));
  }));

  /* ---------- achievements ---------- */
  r.get("/achievements", wrap(() => computeAchievements(db, tz(), todayIn(tz()))));

  /* ---------- export ---------- */
  r.get("/export", wrap((req, res) => {
    const q = parse(
      z.object({ from: isoDate.optional(), to: isoDate.optional(), date: isoDate.optional(), format: z.enum(["json", "md"]).default("json"), download: z.string().optional() }),
      req.query,
    );
    const to = q.to ?? q.date ?? todayIn(tz());
    const from = q.from ?? q.date ?? to;
    if (from > to) throw new HttpError(400, "from must be <= to");
    if (addDays(from, 92) < to) throw new HttpError(400, "range too large (max 92 days)");
    const bundle = buildBundle(db, from, to);
    const name = `sentience_${from}${from === to ? "" : `_to_${to}`}`;
    if (q.format === "md") {
      res.type("text/markdown; charset=utf-8");
      if (q.download) res.attachment(`${name}.md`);
      res.send(bundleToMarkdown(bundle));
      return;
    }
    if (q.download) res.attachment(`${name}.json`);
    return bundle;
  }));

  /* ---------- sync (iOS) ---------- */
  r.post("/sync", wrap((req) => sync(db, parse(SyncPushSchema, req.body))));

  /* ---------- stats for the home screen ---------- */
  r.get("/stats", wrap(() => {
    const zone = tz();
    const today = todayIn(zone);
    return {
      today,
      timezone: zone,
      events: events.countEvents(db),
      daysLogged: events.distinctEventDays(db, zone).length,
      streak: loggingStreak(db, zone, today),
      health: health.healthCoverage(db),
      facts: profile.listFacts(db).length,
      goals: goals.listGoals(db).length,
    };
  }));

  return r;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
