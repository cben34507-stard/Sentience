import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Ruler } from "lucide-react";
import { BODY_PANEL, LAB_TEST_BY_KEY, TAPE_SITES, type LabResult, type LabResultInput, type Profile } from "@sentience/shared";
import { api } from "../lib/api";
import { fmtNum, fromInputDateTime, toInputDateTime } from "../lib/date";
import { Card, Empty, Field, Modal, SectionTitle } from "./ui";
import { LabTrend, Spark } from "./LabCharts";

type LengthUnit = "cm" | "in";
const UNIT_KEY = "sentience.lengthUnit";
const CM_PER_IN = 2.54;

const TIPS: Record<string, string> = {
  neck: "Just below the Adam's apple, tape level.",
  shoulders: "Around the widest point of the shoulders, arms relaxed.",
  chest: "Across the nipples, under the arms, after a normal breath out.",
  bicep_l: "Midway between shoulder and elbow, arm relaxed by your side.",
  bicep_r: "Midway between shoulder and elbow, arm relaxed by your side.",
  forearm: "Widest part, arm relaxed.",
  waist: "Halfway between the bottom rib and top of the hip bone, after breathing out. Don't suck in.",
  hips: "Widest part of the buttocks, feet together.",
  thigh_l: "Widest part, standing, weight on both legs.",
  thigh_r: "Widest part, standing, weight on both legs.",
  calf_l: "Widest part, standing.",
  calf_r: "Widest part, standing.",
};

const EXTRA = ["weight", "body_fat"] as const;

function useLengthUnit(): [LengthUnit, (u: LengthUnit) => void] {
  const [u, setU] = useState<LengthUnit>(() => {
    try {
      return (localStorage.getItem(UNIT_KEY) as LengthUnit) || "cm";
    } catch {
      return "cm";
    }
  });
  return [
    u,
    (n) => {
      setU(n);
      try {
        localStorage.setItem(UNIT_KEY, n);
      } catch {
        /* ignore */
      }
    },
  ];
}

const show = (cm: number, u: LengthUnit) => (u === "cm" ? cm : cm / CM_PER_IN);

export function Body({ results, profile, onSaved }: { results: LabResult[]; profile: Profile | null; onSaved: (msg: string) => Promise<void> }) {
  const [unit, setUnit] = useLengthUnit();
  const [measuring, setMeasuring] = useState(false);
  const [selected, setSelected] = useState<string>("waist");

  const bySite = useMemo(() => {
    const m = new Map<string, LabResult[]>();
    for (const r of results) if (r.value != null) m.set(r.testKey, [...(m.get(r.testKey) ?? []), r]);
    for (const [k, v] of m) m.set(k, v.sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt)));
    return m;
  }, [results]);

  const latest = (k: string) => bySite.get(k)?.at(-1)?.value ?? null;
  const waist = latest("waist");
  const hips = latest("hips");
  const whtr = waist && profile?.heightCm ? waist / profile.heightCm : null;
  const whr = waist && hips ? waist / hips : null;
  const whrLimit = profile?.sex === "female" ? 0.85 : profile?.sex === "male" ? 0.9 : null;

  const sites = [...TAPE_SITES, ...EXTRA].filter((k) => bySite.has(k));
  const current = bySite.get(selected) ?? bySite.get(sites[0] ?? "") ?? [];
  const isLength = (k: string) => LAB_TEST_BY_KEY[k]?.unit === "cm";
  const unitFor = (k: string) => (isLength(k) ? unit : LAB_TEST_BY_KEY[k]?.unit ?? "");
  const fmt = (k: string, v: number) => fmtNum(isLength(k) ? show(v, unit) : v, 1);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <UnitToggle unit={unit} onChange={setUnit} />
        <button className="btn-primary" onClick={() => setMeasuring(true)}>
          <Ruler className="h-4 w-4" /> Take measurements
        </button>
      </div>

      {sites.length === 0 ? (
        <Empty icon={Ruler} title="No measurements yet" body="Grab the tape measure: neck, chest, arms, waist, hips, thighs and calves in one go. Same time of day each time, ideally first thing." />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {sites.map((k) => {
                const rows = bySite.get(k)!;
                const last = rows.at(-1)!;
                const prev = rows.at(-2);
                const delta = prev ? last.value! - prev.value! : null;
                const Icon = delta == null || Math.abs(delta) < 0.05 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
                return (
                  <button
                    key={k}
                    onClick={() => setSelected(k)}
                    className={`card p-4 text-left transition hover:border-line-2 ${selected === k ? "ring-2 ring-ink/80" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-medium text-ink-3">{LAB_TEST_BY_KEY[k]?.name ?? last.name}</div>
                      <Spark results={rows} />
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                      {fmt(k, last.value!)} <span className="text-xs font-normal text-ink-3">{unitFor(k)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                      <Icon className="h-3.5 w-3.5" />
                      {delta == null ? "first measurement" : `${delta > 0 ? "+" : ""}${fmt(k, delta)} ${unitFor(k)} since ${new Date(prev!.takenAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <SectionTitle>Ratios</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Ratio
                  label="Waist to height"
                  value={whtr}
                  hint={whtr == null ? (profile?.heightCm ? "Measure your waist" : "Add your height in Profile") : whtr < 0.5 ? "Healthy (below 0.5)" : whtr < 0.6 ? "Increased risk (0.5 to 0.6)" : "High risk (0.6 or more)"}
                  good={whtr != null && whtr < 0.5}
                />
                <Ratio
                  label="Waist to hip"
                  value={whr}
                  hint={whr == null ? "Measure waist and hips" : whrLimit ? (whr < whrLimit ? `Below the ${whrLimit} risk threshold` : `At or above the ${whrLimit} risk threshold`) : "Threshold 0.90 (men) / 0.85 (women)"}
                  good={whr != null && whrLimit != null && whr < whrLimit}
                />
              </div>
              <p className="mt-3 text-xs text-ink-3">Waist-to-height under 0.5 is the NHS guide ("keep your waist to less than half your height").</p>
            </Card>
            {current.length > 0 && (
              <Card className="p-5">
                <SectionTitle>{LAB_TEST_BY_KEY[current[0].testKey]?.name ?? current[0].name} over time</SectionTitle>
                <LabTrend results={isLength(current[0].testKey) && unit === "in" ? current.map((r) => ({ ...r, value: r.value! / CM_PER_IN, unit: "in" })) : current} />
              </Card>
            )}
          </div>
        </div>
      )}

      <MeasureForm open={measuring} unit={unit} onUnit={setUnit} onClose={() => setMeasuring(false)} onSaved={onSaved} previous={(k) => latest(k)} />
    </div>
  );
}

function Ratio({ label, value, hint, good }: { label: string; value: number | null; hint: string; good: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${value == null ? "text-ink-3" : good ? "text-good" : "text-warn"}`}>{value == null ? "—" : value.toFixed(2)}</div>
      <div className="text-xs text-ink-3">{hint}</div>
    </div>
  );
}

function UnitToggle({ unit, onChange }: { unit: LengthUnit; onChange: (u: LengthUnit) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-paper-2 p-1" role="radiogroup" aria-label="Length unit">
      {(["cm", "in"] as const).map((u) => (
        <button
          key={u}
          role="radio"
          aria-checked={unit === u}
          onClick={() => onChange(u)}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${unit === u ? "bg-paper text-ink shadow-soft" : "text-ink-3 hover:text-ink"}`}
        >
          {u === "cm" ? "Centimetres" : "Inches"}
        </button>
      ))}
    </div>
  );
}

function MeasureForm({
  open,
  unit,
  onUnit,
  onClose,
  onSaved,
  previous,
}: {
  open: boolean;
  unit: LengthUnit;
  onUnit: (u: LengthUnit) => void;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
  previous: (k: string) => number | null;
}) {
  const [takenAt, setTakenAt] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTakenAt(toInputDateTime(new Date().toISOString()));
    setVals({});
    setErr(null);
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items: LabResultInput[] = [];
    for (const [k, raw] of Object.entries(vals)) {
      const n = Number(raw.replace(",", "."));
      if (!raw.trim() || !Number.isFinite(n) || n <= 0) continue;
      const preset = LAB_TEST_BY_KEY[k];
      let value = n;
      if (preset.unit === "cm" && unit === "in") value = n * CM_PER_IN;
      if (k === "weight" && weightUnit === "lb") value = n * 0.45359237;
      items.push({ testKey: k, name: preset.name, panel: BODY_PANEL, value: Math.round(value * 10) / 10, unit: preset.unit, takenAt: fromInputDateTime(takenAt), lab: "Self-measured" });
    }
    if (items.length === 0) {
      setErr("Enter at least one measurement.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.labs.bulk(items);
      await onSaved(`Saved ${res.created} measurement${res.created === 1 ? "" : "s"}${res.duplicates ? `; ${res.duplicates} already recorded` : ""}`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const row = (k: string, label: string, u: string, tip?: string) => {
    const prev = previous(k);
    const prevShown = prev == null ? null : LAB_TEST_BY_KEY[k].unit === "cm" ? show(prev, unit) : k === "weight" && weightUnit === "lb" ? prev / 0.45359237 : prev;
    return (
      <div key={k} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 border-b border-line py-2.5 last:border-0">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {tip && <div className="truncate text-xs text-ink-3" title={tip}>{tip}</div>}
        </div>
        <div className="relative">
          <input
            className="field pr-10 tabular-nums"
            inputMode="decimal"
            placeholder={prevShown != null ? fmtNum(prevShown, 1) : "—"}
            value={vals[k] ?? ""}
            onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
            aria-label={label}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">{u}</span>
        </div>
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Take measurements" wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="Measured">
            <input className="field" type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} required />
          </Field>
          <UnitToggle unit={unit} onChange={onUnit} />
        </div>
        <p className="text-xs text-ink-3">Leave any blank. The grey number is your last measurement. Tape snug, not tight, and level all the way round.</p>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <div>{TAPE_SITES.slice(0, 6).map((k) => row(k, LAB_TEST_BY_KEY[k].name, unit, TIPS[k]))}</div>
          <div>{TAPE_SITES.slice(6).map((k) => row(k, LAB_TEST_BY_KEY[k].name, unit, TIPS[k]))}</div>
        </div>
        <div className="grid grid-cols-1 gap-x-8 border-t border-line pt-3 md:grid-cols-2">
          <div>
            {row("weight", "Weight", weightUnit)}
            <button type="button" className="text-xs text-ink-3 hover:text-ink" onClick={() => setWeightUnit((w) => (w === "kg" ? "lb" : "kg"))}>
              Switch to {weightUnit === "kg" ? "pounds" : "kilograms"}
            </button>
          </div>
          <div>{row("body_fat", "Body fat (smart scale or calipers)", "%")}</div>
        </div>
        {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save measurements"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
