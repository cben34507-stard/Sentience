import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUp, FlaskConical, HeartPulse, Info, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { BODY_PANEL, LAB_INFO, LAB_TESTS, LAB_TEST_BY_KEY, labFlag, presetRange, type LabFlag, type Fact, type LabResult, type LabResultInput, type Profile } from "@sentience/shared";
import { useSearchParams } from "react-router-dom";
import { Body } from "../components/Body";
import { Genetics } from "../components/Genetics";
import { ImportRecord } from "../components/ImportRecord";
import { api } from "../lib/api";
import { fmtNum, toInputDateTime, fromInputDateTime } from "../lib/date";
import { Card, Empty, Field, Modal, PageTitle, SectionTitle, Spinner, useToast } from "../components/ui";
import { Select, type SelectOption } from "../components/Select";
import { FlagBadge, FlagDot, LabTrend, Spark, rangeText } from "../components/LabCharts";

const PANELS = [...new Set(LAB_TESTS.filter((t) => t.panel !== BODY_PANEL).map((t) => t.panel))];

const TABS = [
  { key: "bloods", label: "Bloods & clinic" },
  { key: "body", label: "Body measurements" },
  { key: "genetics", label: "Genetics" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const TEST_OPTIONS: SelectOption[] = [
  ...LAB_TESTS.filter((t) => t.panel !== BODY_PANEL).map((t) => ({
    value: t.key,
    label: t.name,
    hint: `${t.unit}${t.healthKit ? " · shares to Apple Health" : ""}`,
    group: t.panel,
    icon: t.healthKit ? <HeartPulse className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />,
  })),
  { value: "custom", label: "Other test…", hint: "Type the name yourself", group: "Custom", icon: <Plus className="h-4 w-4" /> },
];

interface Series {
  key: string;
  name: string;
  panel: string;
  unit: string;
  results: LabResult[];
  latest: LabResult;
}

function groupResults(results: LabResult[]): Series[] {
  const by = new Map<string, LabResult[]>();
  for (const r of results) {
    const k = r.testKey === "custom" ? `custom:${r.name.toLowerCase()}` : r.testKey;
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  return [...by.entries()]
    .map(([key, rs]) => {
      const sorted = [...rs].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
      const latest = sorted[sorted.length - 1];
      return { key, name: latest.name, panel: latest.panel || LAB_TEST_BY_KEY[latest.testKey]?.panel || "Other", unit: latest.unit, results: sorted, latest };
    })
    .sort((a, b) => a.panel.localeCompare(b.panel) || a.name.localeCompare(b.name));
}

export function Tests() {
  const [results, setResults] = useState<LabResult[] | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "bloods") as Tab;
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<LabResult | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const [l, f, p] = await Promise.all([api.labs.list(), api.facts.list(), api.profile.get()]);
    setResults(l);
    setFacts(f);
    setProfile(p);
  }, []);
  useEffect(() => {
    load().catch((e) => toast(e.message, "err"));
  }, [load, toast]);

  const bloods = useMemo(() => (results ?? []).filter((r) => r.panel !== BODY_PANEL), [results]);
  const body = useMemo(() => (results ?? []).filter((r) => r.panel === BODY_PANEL), [results]);
  const series = useMemo(() => groupResults(bloods), [bloods]);
  const current = series.find((s) => s.key === selected) ?? series[0] ?? null;
  const flagged = series.filter((s) => ["low", "high"].includes(labFlag(s.latest)));

  const panels = useMemo(() => {
    const m = new Map<string, Series[]>();
    for (const s of series) m.set(s.panel, [...(m.get(s.panel) ?? []), s]);
    return [...m.entries()];
  }, [series]);

  return (
    <div>
      <PageTitle
        title="Tests"
        subtitle="Bloods, clinic visits, tape-measure results and genetics, tracked over time and included in every export."
        actions={
          tab === "bloods" ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost border border-line" onClick={() => setImporting(true)}>
                <FileUp className="h-4 w-4" /> Import GP record
              </button>
              <button className="btn-primary" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add results
              </button>
            </div>
          ) : null
        }
      />

      <div className="mb-6 inline-flex flex-wrap rounded-full border border-line bg-paper-2 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setParams(t.key === "bloods" ? {} : { tab: t.key })}
            className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "text-ink" : "text-ink-3 hover:text-ink"}`}
          >
            {tab === t.key && <motion.span layoutId="tests-tab" className="absolute inset-0 rounded-full bg-paper shadow-soft" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "body" && results && (
        <Body
          results={body}
          profile={profile}
          onSaved={async (msg) => {
            await load();
            toast(msg);
          }}
        />
      )}
      {tab === "genetics" && <Genetics facts={facts} onChanged={load} />}

      {tab === "bloods" && (<>
      <Card className="mb-6 flex items-start gap-3 p-4 text-sm text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
        <p>
          Results marked <HeartPulse className="mx-0.5 inline h-3.5 w-3.5 align-[-2px]" /> are written into Apple Health by the iPhone app on its next sync (glucose, blood pressure, oxygen, temperature, weight, BMI, body fat, waist, lung function).
          Apple keeps lab panels like cholesterol or vitamin D as read-only records that only hospitals can add, so those stay in Sentience.
        </p>
      </Card>

      {results == null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : series.length === 0 ? (
        <Empty
          icon={FlaskConical}
          title="No test results yet"
          body="Add a blood test or clinic visit. Enter a whole report at once: pick the date, then each result."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-ghost border border-line" onClick={() => setImporting(true)}>
                <FileUp className="h-4 w-4" /> Import from Patient Access
              </button>
              <button className="btn-primary" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add results
              </button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)]">
          <div className="space-y-5">
            {flagged.length > 0 && (
              <Card className="p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Outside range on latest test</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {flagged.map((s) => (
                    <button key={s.key} onClick={() => setSelected(s.key)} className="chip">
                      <FlagDot flag={labFlag(s.latest)} /> {s.name}
                    </button>
                  ))}
                </div>
              </Card>
            )}
            {panels.map(([panel, list]) => (
              <div key={panel}>
                <SectionTitle>{panel}</SectionTitle>
                <div className="card divide-y divide-line overflow-hidden p-0">
                  {list.map((s) => {
                    const flag = labFlag(s.latest);
                    const active = current?.key === s.key;
                    return (
                      <button key={s.key} onClick={() => setSelected(s.key)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active ? "bg-paper-3" : "hover:bg-paper-2"}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {s.name}
                            {LAB_TEST_BY_KEY[s.latest.testKey]?.healthKit && <HeartPulse className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-label="Shares to Apple Health" />}
                          </div>
                          <div className="text-xs text-ink-3">
                            {s.latest.takenAt.slice(0, 10)} · {s.results.length} result{s.results.length === 1 ? "" : "s"}
                          </div>
                        </div>
                        <Spark results={s.results} />
                        <div className="w-24 shrink-0 text-right">
                          <div className="text-sm font-semibold tabular-nums">
                            {s.latest.value != null ? fmtNum(s.latest.value, 2) : s.latest.valueText}
                            <span className="ml-1 text-xs font-normal text-ink-3">{s.unit}</span>
                          </div>
                          <FlagBadge flag={flag} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {current && (
              <div key={current.key} className="fade-in-x">
                <Card className="p-6 lg:sticky lg:top-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{current.panel}</div>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{current.name}</h2>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-semibold tabular-nums tracking-tight">
                        {current.latest.value != null ? fmtNum(current.latest.value, 2) : current.latest.valueText}
                        <span className="ml-1.5 text-sm font-normal text-ink-3">{current.unit}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-2 text-xs text-ink-3">
                        <FlagBadge flag={labFlag(current.latest)} />
                        {rangeText(current.latest)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <LabTrend results={current.results} />
                  </div>
                  <LabAbout testKey={current.latest.testKey} flag={labFlag(current.latest)} />
                  <div className="-mx-6 mt-6 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-3">
                          <th className="px-6 py-2 font-semibold">Taken</th>
                          <th className="px-3 py-2 font-semibold">Result</th>
                          <th className="px-3 py-2 font-semibold">Range</th>
                          <th className="px-3 py-2 font-semibold">Lab</th>
                          <th className="px-6 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {[...current.results].reverse().map((r) => (
                          <tr key={r.id} className="border-t border-line">
                            <td className="px-6 py-2.5 tabular-nums">{new Date(r.takenAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
                            <td className="px-3 py-2.5 tabular-nums">
                              <span className="font-medium">{r.value != null ? fmtNum(r.value, 2) : r.valueText}</span> <span className="text-ink-3">{r.unit}</span>{" "}
                              <FlagBadge flag={labFlag(r)} />
                            </td>
                            <td className="px-3 py-2.5 text-ink-2">{rangeText(r)}</td>
                            <td className="px-3 py-2.5 text-ink-2">{r.lab || "—"}</td>
                            <td className="px-6 py-2.5 text-right">
                              <button className="btn-ghost h-8 w-8 p-0" onClick={() => setEditing(r)} aria-label="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {current.latest.notes && <p className="mt-4 text-sm text-ink-2">{current.latest.notes}</p>}
                </Card>
              </div>
            )}
        </div>
      )}
      </>)}

      <AddResults
        sex={profile?.sex}
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={async (msg) => {
          await load();
          toast(msg);
        }}
      />
      <ImportRecord
        open={importing}
        onClose={() => setImporting(false)}
        onImported={async (msg) => {
          await load();
          toast(msg);
        }}
      />
      <EditResult
        result={editing}
        onClose={() => setEditing(null)}
        onSaved={async (msg) => {
          await load();
          toast(msg);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

interface Row {
  id: number;
  testKey: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

let rowSeq = 1;
const blankRow = (): Row => ({ id: rowSeq++, testKey: "", name: "", value: "", unit: "", refLow: "", refHigh: "" });
const fromPreset = (key: string, sex?: string): Row => {
  const t = LAB_TEST_BY_KEY[key];
  const r = t ? presetRange(t, sex) : {};
  return { id: rowSeq++, testKey: key, name: t?.name ?? "", value: "", unit: t?.unit ?? "", refLow: r.refLow?.toString() ?? "", refHigh: r.refHigh?.toString() ?? "" };
};

function AddResults({ open, onClose, onSaved, sex }: { open: boolean; onClose: () => void; onSaved: (msg: string) => Promise<void>; sex?: string }) {
  const [takenAt, setTakenAt] = useState("");
  const [lab, setLab] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [panel, setPanel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    setTakenAt(toInputDateTime(d.toISOString()));
    setLab("");
    setNotes("");
    setRows([blankRow()]);
    setPanel("");
    setErr(null);
  }, [open]);

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addPanel = (p: string) => {
    const keys = LAB_TESTS.filter((t) => t.panel === p).map((t) => t.key);
    setRows((rs) => [...rs.filter((r) => r.testKey || r.value), ...keys.filter((k) => !rs.some((r) => r.testKey === k)).map((k) => fromPreset(k, sex))]);
    setPanel("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const filled = rows.filter((r) => r.testKey && r.value.trim());
    if (filled.length === 0) {
      setErr("Add at least one result with a value.");
      return;
    }
    const items: LabResultInput[] = filled.map((r) => {
      const preset = LAB_TEST_BY_KEY[r.testKey];
      const num = Number(r.value.replace(",", "."));
      const numeric = r.value.trim() !== "" && Number.isFinite(num);
      return {
        testKey: r.testKey,
        name: r.testKey === "custom" ? r.name.trim() || "Custom test" : preset?.name ?? r.name,
        panel: preset?.panel ?? "Other",
        value: numeric ? num : null,
        valueText: numeric ? null : r.value.trim(),
        unit: r.unit,
        refLow: r.refLow === "" ? null : Number(r.refLow),
        refHigh: r.refHigh === "" ? null : Number(r.refHigh),
        takenAt: fromInputDateTime(takenAt),
        lab,
        notes,
      };
    });
    setBusy(true);
    try {
      const res = await api.labs.bulk(items);
      await onSaved(res.duplicates ? `Saved ${res.created}; ${res.duplicates} were already on record` : `Saved ${res.created} result${res.created === 1 ? "" : "s"}`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add test results" wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Sample taken">
            <input className="field" type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} required />
          </Field>
          <Field label="Where">
            <input className="field" value={lab} onChange={(e) => setLab(e.target.value)} placeholder="GP surgery, hospital, private lab" />
          </Field>
          <Field label="Add a whole panel">
            <Select value={panel} onChange={addPanel} placeholder="Choose a panel" options={PANELS.map((p) => ({ value: p, label: p, icon: <Layers className="h-4 w-4" /> }))} />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 md:grid">
            <span>Test</span>
            <span>Result</span>
            <span>Unit</span>
            <span>Low</span>
            <span>High</span>
            <span />
          </div>
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_36px] md:border-0 md:p-0"
              >
                <div className="col-span-2 space-y-2 md:col-span-1">
                  <Select
                    value={r.testKey}
                    placeholder="Choose test"
                    searchable
                    options={TEST_OPTIONS}
                    onChange={(k) => {
                      const p = fromPreset(k, sex);
                      update(r.id, { testKey: k, name: k === "custom" ? "" : p.name, unit: p.unit, refLow: p.refLow, refHigh: p.refHigh });
                    }}
                  />
                  {r.testKey === "custom" && <input className="field" placeholder="Test name" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />}
                </div>
                <input className="field tabular-nums" inputMode="decimal" placeholder="Value" value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} aria-label="Value" />
                <input className="field" placeholder="Unit" value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value })} aria-label="Unit" />
                <input className="field tabular-nums" inputMode="decimal" placeholder="—" value={r.refLow} onChange={(e) => update(r.id, { refLow: e.target.value })} aria-label="Range low" />
                <input className="field tabular-nums" inputMode="decimal" placeholder="—" value={r.refHigh} onChange={(e) => update(r.id, { refHigh: e.target.value })} aria-label="Range high" />
                <button type="button" className="btn-ghost h-10 w-9 p-0" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [blankRow()]))} aria-label="Remove row">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <button type="button" className="btn-ghost text-sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            <Plus className="h-4 w-4" /> Add another test
          </button>
          <p className="px-1 text-xs text-ink-3">Ranges are pre-filled with typical adult values. Labs differ, so swap in the range printed on your report.</p>
        </div>

        <Field label="Notes">
          <textarea className="field min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fasting? What the doctor said?" />
        </Field>

        {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save results"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditResult({ result, onClose, onSaved }: { result: LabResult | null; onClose: () => void; onSaved: (msg: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [refLow, setRefLow] = useState("");
  const [refHigh, setRefHigh] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [lab, setLab] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!result) return;
    setValue(result.value != null ? String(result.value) : result.valueText ?? "");
    setUnit(result.unit);
    setRefLow(result.refLow?.toString() ?? "");
    setRefHigh(result.refHigh?.toString() ?? "");
    setTakenAt(toInputDateTime(result.takenAt));
    setLab(result.lab);
    setNotes(result.notes);
  }, [result]);

  if (!result) return <Modal open={false} onClose={onClose} title="" children={null} />;
  const num = Number(value.replace(",", "."));
  const numeric = value.trim() !== "" && Number.isFinite(num);

  return (
    <Modal open={!!result} onClose={onClose} title={result.name}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await api.labs.update(result.id, {
            value: numeric ? num : null,
            valueText: numeric ? null : value.trim(),
            unit,
            refLow: refLow === "" ? null : Number(refLow),
            refHigh: refHigh === "" ? null : Number(refHigh),
            takenAt: fromInputDateTime(takenAt),
            lab,
            notes,
          });
          await onSaved("Result updated");
          onClose();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Result">
            <input className="field" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Unit">
            <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
          <Field label="Range low">
            <input className="field" value={refLow} onChange={(e) => setRefLow(e.target.value)} />
          </Field>
          <Field label="Range high">
            <input className="field" value={refHigh} onChange={(e) => setRefHigh(e.target.value)} />
          </Field>
          <Field label="Taken">
            <input className="field" type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
          </Field>
          <Field label="Where">
            <input className="field" value={lab} onChange={(e) => setLab(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="field min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            className="btn-ghost text-bad hover:text-bad"
            onClick={async () => {
              if (!confirm("Delete this result?")) return;
              await api.labs.remove(result.id);
              await onSaved("Result deleted");
              onClose();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary">Save</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** What the test is, what this result direction usually means, and the UK range. */
function LabAbout({ testKey, flag }: { testKey: string; flag: LabFlag }) {
  const info = LAB_INFO[testKey];
  if (!info) return null;
  const direction = flag === "high" ? info.high : flag === "low" ? info.low : null;
  return (
    <div className="mt-6 space-y-3 rounded-2xl border border-line bg-paper-2 p-4 text-sm">
      <p className="text-ink-2">{info.what}</p>
      {direction && (
        <div className={`rounded-xl border px-3 py-2 ${flag === "high" ? "border-bad/30" : "border-warn/30"}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${flag === "high" ? "text-bad" : "text-warn"}`}>Your latest is {flag}</div>
          <p className="mt-1 text-ink">{direction}</p>
        </div>
      )}
      {!direction && flag === "normal" && (info.high || info.low) && (
        <details className="text-ink-2">
          <summary className="cursor-pointer text-ink-3">What would high or low mean?</summary>
          <div className="mt-2 space-y-1.5">
            {info.high && (
              <p>
                <span className="font-medium text-ink">High: </span>
                {info.high}
              </p>
            )}
            {info.low && (
              <p>
                <span className="font-medium text-ink">Low: </span>
                {info.low}
              </p>
            )}
          </div>
        </details>
      )}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">UK range</div>
        <p className="mt-1 text-ink-2">{info.uk}</p>
      </div>
      {info.tip && <p className="text-xs text-ink-3">{info.tip}</p>}
      <p className="text-[11px] text-ink-3">General information, not a diagnosis. Your GP reads results alongside your history.</p>
    </div>
  );
}
