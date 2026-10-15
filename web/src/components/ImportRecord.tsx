import { useMemo, useRef, useState } from "react";
import { FileUp, ShieldCheck } from "lucide-react";
import { api, fileToBase64, type PatientAccessPreview } from "../lib/api";
import { fmtNum } from "../lib/date";
import { Modal, Spinner } from "./ui";
import { FlagBadge } from "./LabCharts";

/**
 * Patient Access export → preview → import. The file goes to your own server
 * only; the name, date of birth and NHS number in it are ignored there.
 */
export function ImportRecord({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (msg: string) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; b64: string } | null>(null);
  const [preview, setPreview] = useState<PatientAccessPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setErr(null);
    setShowAll(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    reset();
    setBusy(true);
    try {
      const b64 = await fileToBase64(f);
      setFile({ name: f.name, b64 });
      setPreview(await api.labs.previewPatientAccess(b64));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setBusy(false);
    }
  };

  const byDate = useMemo(() => {
    if (!preview) return [];
    const m = new Map<string, PatientAccessPreview["rows"]>();
    for (const r of [...preview.rows].reverse()) {
      const d = r.takenAt.slice(0, 10);
      m.set(d, [...(m.get(d) ?? []), r]);
    }
    return [...m.entries()];
  }, [preview]);
  const flagged = preview?.rows.filter((r) => r.flag === "high" || r.flag === "low") ?? [];
  const shown = showAll ? byDate : byDate.slice(0, 4);

  return (
    <Modal open={open} onClose={close} title="Import from Patient Access" wide>
      {!preview && (
        <div className="space-y-4 text-sm text-ink-2">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              In the Patient Access app or website, open <span className="font-medium text-ink">Medical record</span> and download or export it. You get an <code className="font-mono text-xs">.xml</code> file.
            </li>
            <li>Choose that file here. You'll see everything before anything is saved.</li>
          </ol>
          <div className="flex items-start gap-2 rounded-xl border border-line bg-paper-2 p-3 text-xs">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
            Only test results are read. Your name, date of birth and NHS number in the file are ignored and never stored. Importing twice is safe: results already saved are skipped.
          </div>
          <input ref={input} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button className="btn-primary" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Spinner /> : <FileUp className="h-4 w-4" />} Choose file
          </button>
          {err && <p className="text-sm text-bad">{err}</p>}
        </div>
      )}

      {preview && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Results found" value={preview.rows.length} />
            <Stat label="New" value={preview.newCount} />
            <Stat label="Outside range" value={flagged.length} />
            <Stat label="Dates" value={preview.from && preview.to ? (short(preview.from) === short(preview.to) ? short(preview.to) : year(preview.from) === year(preview.to) ? year(preview.to) : `${year(preview.from)}–${year(preview.to)}`) : "—"} />
          </div>
          <p className="text-xs text-ink-3">
            From {file?.name}. Ranges come from your report where the lab printed one; otherwise the UK range for that test is used and marked "UK".
          </p>

          <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
            {shown.map(([date, rows]) => (
              <div key={date}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{long(date)}</div>
                <div className="divide-y divide-line rounded-xl border border-line">
                  {rows.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 text-sm ${r.exists ? "opacity-50" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.name}</div>
                        <div className="truncate text-xs text-ink-3">{r.panel}</div>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        {r.valueText ?? (r.value != null ? fmtNum(r.value, 2) : "")} <span className="text-xs text-ink-3">{r.unit}</span>
                        <div className="text-[11px] text-ink-3">
                          {range(r.refLow, r.refHigh)}
                          {r.rangeFrom === "preset" && (r.refLow != null || r.refHigh != null) ? " UK" : ""}
                        </div>
                      </div>
                      <div className="w-20 shrink-0 whitespace-nowrap text-right">{r.exists ? <span className="text-[11px] text-ink-3">saved</span> : <FlagBadge flag={r.flag} />}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {byDate.length > shown.length && (
              <button className="btn-ghost w-full" onClick={() => setShowAll(true)}>
                Show all {byDate.length} dates
              </button>
            )}
            {preview.skipped.length > 0 && (
              <details className="text-xs text-ink-3">
                <summary className="cursor-pointer">{preview.skipped.length} entries without a value (scans, cultures, ECG traces) won't be imported</summary>
                <ul className="mt-2 space-y-0.5 pl-4">
                  {preview.skipped.map((s, i) => (
                    <li key={i}>
                      {s.date} · {s.description}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {err && <p className="text-sm text-bad">{err}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-ghost" onClick={reset}>
              Choose another file
            </button>
            <button
              className="btn-primary"
              disabled={busy || preview.newCount === 0}
              onClick={async () => {
                if (!file) return;
                setBusy(true);
                setErr(null);
                try {
                  const res = await api.labs.importPatientAccess(file.b64);
                  close();
                  await onImported(`Imported ${res.created} result${res.created === 1 ? "" : "s"}${res.duplicates ? `, ${res.duplicates} already saved` : ""}`);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Import failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Spinner /> : <FileUp className="h-4 w-4" />}
              {preview.newCount === 0 ? "Nothing new to import" : `Import ${preview.newCount} result${preview.newCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-2 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });
const long = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
const year = (d: string) => d.slice(0, 4);
function range(lo?: number | null, hi?: number | null): string {
  if (lo != null && hi != null) return `${lo}–${hi}`;
  if (lo != null) return `≥ ${lo}`;
  if (hi != null) return `≤ ${hi}`;
  return "";
}
