import { useCallback, useEffect, useRef, useState } from "react";
import { HEALTH_TYPE_META } from "@sentience/shared";
import { api, type ImportJob, type Stats, type TypeStat } from "../lib/api";
import { fmtNum } from "../lib/date";
import { Card, Empty, PageTitle, SectionTitle, Spinner, Stat, useToast } from "../components/ui";
import { Copy, Inbox, ShieldCheck, Smartphone, Upload } from "lucide-react";
import { Insights } from "../components/Insights";

export function Health() {
  const [coverage, setCoverage] = useState<Stats["health"] | null>(null);
  const [types, setTypes] = useState<TypeStat[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const [c, t, j] = await Promise.all([api.health.coverage(), api.health.types(), api.health.imports()]);
    setCoverage(c);
    setTypes(t);
    setJobs(j);
  }, []);

  useEffect(() => {
    load().catch((e) => toast(e.message, "err"));
  }, [load, toast]);

  // Poll while an import is running.
  const active = jobs.find((j) => j.status === "queued" || j.status === "running" || j.status === "hashing");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => load().catch(() => undefined), 1500);
    return () => clearInterval(t);
  }, [active, load]);

  const [lastFile, setLastFile] = useState<File | null>(null);
  const upload = async (file: File, force = false) => {
    if (!/\.(zip|xml)$/i.test(file.name)) {
      toast("Pick export.zip (or export.xml)", "err");
      return;
    }
    setUploading(true);
    try {
      setLastFile(file);
      await api.health.upload(file, force);
      toast("Uploaded. Importing in the background");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "err");
    } finally {
      setUploading(false);
    }
  };

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <PageTitle title="Health" subtitle="Bring your Apple Health history in so every day on the timeline carries your heart rate, steps, sleep and workouts." />

      <Card className="mb-6 p-5">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
          <Stat label="Samples" value={fmtNum(coverage?.samples)} />
          <Stat label="Workouts" value={fmtNum(coverage?.workouts)} />
          <Stat label="From" value={coverage?.first ? coverage.first.slice(0, 10) : "—"} />
          <Stat label="To" value={coverage?.last ? coverage.last.slice(0, 10) : "—"} />
          <Stat label="Sources" value={coverage?.sources?.length ?? 0} hint={coverage?.sources?.slice(0, 3).join(", ")} />
        </div>
      </Card>

      {(coverage?.samples ?? 0) > 0 && (
        <div className="mb-6">
          <Insights />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>Import an Apple Health export</SectionTitle>
            <div
              className={`grid place-items-center rounded-xl2 border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-ink bg-paper-2" : "border-line"}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) void upload(f);
              }}
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-paper-3 text-ink-2">
                <Upload className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="mt-2 font-medium">Drop export.zip here</div>
              <div className="mt-1 text-sm text-ink-3">Multi-gigabyte files are fine — it streams.</div>
              <button className="btn-primary mt-4" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Spinner className="border-paper/40 border-t-paper" /> : null}
                {uploading ? "Uploading…" : "Choose file"}
              </button>
              <input ref={fileRef} type="file" accept=".zip,.xml" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            </div>
            <ol className="mt-5 space-y-1.5 text-sm text-ink-2">
              <li>
                <b className="text-ink">1.</b> On iPhone open <b className="text-ink">Health</b> → tap your picture → <b className="text-ink">Export All Health Data</b>.
              </li>
              <li>
                <b className="text-ink">2.</b> AirDrop or save the <code className="rounded bg-paper-3 px-1">export.zip</code> to this computer.
              </li>
              <li>
                <b className="text-ink">3.</b> Drop it above. A newer export later only adds what's new.
              </li>
            </ol>
          </Card>

          <Card className="p-5">
            <SectionTitle
              aside={
                jobs[0]?.status === "duplicate" && lastFile ? (
                  <button className="text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline" onClick={() => void upload(lastFile, true)}>
                    Import it anyway
                  </button>
                ) : null
              }
            >
              Imports
            </SectionTitle>
            {jobs.length === 0 ? (
              <div className="text-sm text-ink-3">No imports yet.</div>
            ) : (
              <ul className="divide-y divide-line">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{j.filename}</div>
                      <div className="text-xs text-ink-3">
                        {new Date(j.startedAt).toLocaleString()}
                        {j.exportDate && ` · export from ${j.exportDate.slice(0, 10)}`}
                        {j.status !== "duplicate" && ` · ${fmtNum(j.recordsSeen)} read · ${fmtNum(j.recordsAdded)} new · ${fmtNum(j.recordsSkipped)} already on record · ${j.workoutsSeen} workouts`}
                        {j.error && <span className={j.status === "duplicate" ? "text-ink-2" : "text-bad"}> · {j.error}</span>}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        j.status === "done" ? "bg-good/15 text-good" : j.status === "error" ? "bg-bad/15 text-bad" : "bg-paper-3 text-ink-2"
                      }`}
                    >
                      {(j.status === "running" || j.status === "hashing") && <Spinner className="mr-1 h-3 w-3 align-[-2px]" />}
                      {j.status === "duplicate" ? "already imported" : j.status === "hashing" ? "checking" : j.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>No duplicates</SectionTitle>
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-good" strokeWidth={1.8} />
              <ul className="space-y-2 text-sm text-ink-2">
                <li>The same file uploaded twice is recognised by its fingerprint and skipped.</li>
                <li>Every reading is keyed by type, exact start and end time, and device, so an export and iPhone sync that overlap store each reading once.</li>
                <li>iPhone and Watch both count steps; daily totals take the busier device each hour instead of adding them, like the Health app does.</li>
                <li>Overlapping sleep from several apps is merged into one night.</li>
                <li>Test results Sentience writes into Apple Health are never read back in as new data.</li>
              </ul>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>iPhone app sync</SectionTitle>
            <Smartphone className="mb-2 h-5 w-5 text-ink-2" strokeWidth={1.8} />
            <p className="text-sm text-ink-2">
              The Sentience iOS app logs events offline and pushes HealthKit samples directly, so you don't have to re-export. Point it at this server when you're on the same Wi-Fi:
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl bg-paper-2 px-3 py-2 font-mono text-sm">{serverUrl}</code>
              <button
                className="btn-outline"
                onClick={() => {
                  void navigator.clipboard.writeText(serverUrl).then(() => toast("Copied"));
                }}
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-3">If this says localhost, the server also prints its LAN address on startup — use that one on the phone.</p>
          </Card>

          <Card className="p-5">
            <SectionTitle aside={<span className="text-xs text-ink-3">{types.length} types</span>}>What's on record</SectionTitle>
            {types.length === 0 ? (
              <Empty icon={Inbox} title="No health data yet" body="Import an export or sync from the iOS app." />
            ) : (
              <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
                {types.map((t) => {
                  const meta = HEALTH_TYPE_META[t.type];
                  return (
                    <li key={t.type} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{meta?.label ?? t.type.replace(/^HK(Quantity|Category)TypeIdentifier/, "")}</div>
                        <div className="text-xs text-ink-3">
                          {t.first.slice(0, 10)} to {t.last.slice(0, 10)} · {t.unit} · {t.sources} source{t.sources === 1 ? "" : "s"}
                        </div>
                      </div>
                      <span className="shrink-0 tabular-nums text-ink-2">{fmtNum(t.count)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
