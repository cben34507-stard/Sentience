import fs from "node:fs";
import path from "node:path";
import sax from "sax";
import yauzl from "yauzl";
import type { DB } from "../lib/db.js";
import { newId } from "../lib/ids.js";
import { appleDateToIso } from "../lib/time.js";
import { makeSampleInserter, makeWorkoutInserter } from "./health.js";

export interface ImportJob {
  id: string;
  filename: string;
  status: "queued" | "running" | "done" | "error";
  recordsSeen: number;
  recordsAdded: number;
  workoutsSeen: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface JobRow {
  id: string;
  filename: string;
  status: ImportJob["status"];
  records_seen: number;
  records_added: number;
  workouts_seen: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

const rowToJob = (r: JobRow): ImportJob => ({
  id: r.id,
  filename: r.filename,
  status: r.status,
  recordsSeen: r.records_seen,
  recordsAdded: r.records_added,
  workoutsSeen: r.workouts_seen,
  error: r.error,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
});

export function getJob(db: DB, id: string): ImportJob | null {
  const row = db.prepare(`SELECT * FROM health_imports WHERE id = ?`).get(id) as JobRow | undefined;
  return row ? rowToJob(row) : null;
}

export function listJobs(db: DB): ImportJob[] {
  return (db.prepare(`SELECT * FROM health_imports ORDER BY started_at DESC LIMIT 20`).all() as JobRow[]).map(rowToJob);
}

/**
 * Kicks off a background import of an Apple Health export (export.zip or export.xml).
 * Progress is written to the health_imports table so the UI can poll it.
 */
export function startImport(db: DB, filePath: string, originalName: string): ImportJob {
  const id = newId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO health_imports (id, filename, status, started_at) VALUES (?, ?, 'queued', ?)`,
  ).run(id, originalName, now);

  setImmediate(() => {
    runImport(db, id, filePath, originalName).catch((err) => {
      db.prepare(`UPDATE health_imports SET status='error', error=?, finished_at=? WHERE id=?`).run(
        String(err?.message ?? err),
        new Date().toISOString(),
        id,
      );
    });
  });

  return getJob(db, id)!;
}

async function runImport(db: DB, jobId: string, filePath: string, originalName: string): Promise<void> {
  db.prepare(`UPDATE health_imports SET status='running' WHERE id=?`).run(jobId);
  const stream = await openExportStream(filePath, originalName);
  const counters = await parseExport(db, stream, (c) => {
    db.prepare(`UPDATE health_imports SET records_seen=?, records_added=?, workouts_seen=? WHERE id=?`).run(
      c.seen,
      c.added,
      c.workouts,
      jobId,
    );
  });
  db.prepare(
    `UPDATE health_imports SET status='done', records_seen=?, records_added=?, workouts_seen=?, finished_at=? WHERE id=?`,
  ).run(counters.seen, counters.added, counters.workouts, new Date().toISOString(), jobId);
  fs.promises.unlink(filePath).catch(() => undefined);
}

/** Returns a readable stream of export.xml whether we were handed the zip or the xml. */
function openExportStream(filePath: string, originalName: string): Promise<NodeJS.ReadableStream> {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (ext === ".xml") return Promise.resolve(fs.createReadStream(filePath));
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("could not open zip"));
      let found = false;
      zip.readEntry();
      zip.on("entry", (entry) => {
        const name = entry.fileName.toLowerCase();
        if (!found && name.endsWith("export.xml") && !name.includes("export_cda")) {
          found = true;
          zip.openReadStream(entry, (e, rs) => {
            if (e || !rs) return reject(e ?? new Error("could not read export.xml"));
            resolve(rs);
          });
        } else {
          zip.readEntry();
        }
      });
      zip.on("end", () => {
        if (!found) reject(new Error("export.xml not found in zip — export from the Health app → profile → Export All Health Data"));
      });
      zip.on("error", reject);
    });
  });
}

interface Counters {
  seen: number;
  added: number;
  workouts: number;
}

const BATCH = 5_000;

/** Streams the XML and writes samples in batched transactions. */
export function parseExport(
  db: DB,
  stream: NodeJS.ReadableStream,
  onProgress?: (c: Counters) => void,
): Promise<Counters> {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(false, { lowercase: true, trim: true });
    const insertSample = makeSampleInserter(db);
    const insertWorkout = makeWorkoutInserter(db);
    const counters: Counters = { seen: 0, added: 0, workouts: 0 };

    let inBatch = false;
    const begin = () => {
      if (!inBatch) {
        db.exec("BEGIN");
        inBatch = true;
      }
    };
    const commit = () => {
      if (inBatch) {
        db.exec("COMMIT");
        inBatch = false;
      }
    };

    let currentWorkout: null | {
      activityType: string;
      startAt: string;
      endAt: string;
      durationMin: number;
      energyKcal: number | null;
      distanceKm: number | null;
      sourceName: string;
    } = null;

    parser.on("opentag", (node) => {
      const a = node.attributes as Record<string, string>;
      try {
        if (node.name === "record") {
          begin();
          counters.seen++;
          const type = a.type;
          const isCategory = type?.startsWith("HKCategoryType");
          const startAt = appleDateToIso(a.startdate);
          const endAt = appleDateToIso(a.enddate);
          let value: number;
          let categoryValue: string | null = null;
          if (isCategory) {
            categoryValue = a.value ?? null;
            value = (Date.parse(endAt) - Date.parse(startAt)) / 60_000; // minutes
          } else {
            value = Number(a.value);
            if (!Number.isFinite(value)) return;
          }
          const ok = insertSample({
            type,
            startAt,
            endAt,
            value,
            unit: isCategory ? "min" : a.unit ?? "",
            categoryValue,
            sourceName: a.sourcename ?? "",
            device: a.device ?? null,
          });
          if (ok) counters.added++;
          if (counters.seen % BATCH === 0) {
            commit();
            onProgress?.(counters);
          }
        } else if (node.name === "workout") {
          begin();
          counters.workouts++;
          const durationUnit = a.durationunit ?? "min";
          let duration = Number(a.duration ?? 0);
          if (durationUnit === "s") duration /= 60;
          if (durationUnit === "hr") duration *= 60;
          currentWorkout = {
            activityType: (a.workoutactivitytype ?? "Unknown").replace("HKWorkoutActivityType", ""),
            startAt: appleDateToIso(a.startdate),
            endAt: appleDateToIso(a.enddate),
            durationMin: Math.round(duration * 10) / 10,
            energyKcal: a.totalenergyburned ? Number(a.totalenergyburned) : null,
            distanceKm: a.totaldistance
              ? a.totaldistanceunit === "mi"
                ? Number(a.totaldistance) * 1.609344
                : Number(a.totaldistance)
              : null,
            sourceName: a.sourcename ?? "",
          };
        } else if (node.name === "workoutstatistics" && currentWorkout) {
          // Newer exports carry totals in child elements.
          const t = a.type ?? "";
          const sum = Number(a.sum);
          if (!Number.isFinite(sum)) return;
          if (t.endsWith("ActiveEnergyBurned") && currentWorkout.energyKcal == null) currentWorkout.energyKcal = sum;
          if (/Distance(WalkingRunning|Cycling|Swimming)/.test(t) && currentWorkout.distanceKm == null) {
            currentWorkout.distanceKm = a.unit === "mi" ? sum * 1.609344 : a.unit === "m" ? sum / 1000 : sum;
          }
        }
      } catch (err) {
        // A single malformed row shouldn't sink a multi-gigabyte import.
        if (counters.seen < 5) console.warn("skipping row", err);
      }
    });

    parser.on("closetag", (name) => {
      if (name === "workout" && currentWorkout) {
        insertWorkout(currentWorkout);
        currentWorkout = null;
      }
    });

    parser.on("error", (err) => {
      try {
        if (inBatch) db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      reject(err);
    });

    parser.on("end", () => {
      commit();
      onProgress?.(counters);
      resolve(counters);
    });

    stream.on("error", (err) => {
      try {
        if (inBatch) db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      reject(err);
    });
    stream.pipe(parser);
  });
}
