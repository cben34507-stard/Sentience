import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows, Sparkles } from "lucide-react";
import { addDays, fmtNum, minutesToHm, todayLocal } from "../lib/date";
import { api, type ExploreOptions, type ExploreResult } from "../lib/api";
import { Card, Empty, PageTitle, SectionTitle, Spinner } from "../components/ui";
import { Select, type SelectOption } from "../components/Select";
import { useWidth } from "../components/Charts";

const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last year" },
];
const AFTER = [
  { value: "", label: "at any time" },
  { value: "12", label: "after midday" },
  { value: "14", label: "after 2pm" },
  { value: "18", label: "after 6pm" },
  { value: "20", label: "after 8pm" },
];
const LAGS = [
  { value: "0", label: "the same day" },
  { value: "1", label: "that night / next day" },
  { value: "2", label: "two days later" },
];

const VERDICT: Record<ExploreResult["verdict"], { label: string; cls: string }> = {
  likely: { label: "Likely link", cls: "bg-accent text-paper" },
  possible: { label: "Possible link", cls: "border border-line-2 text-ink" },
  none: { label: "No clear link", cls: "border border-line text-ink-3" },
  "not-enough": { label: "Not enough data", cls: "border border-line text-ink-3" },
};

const fmtY = (v: number, r: Pick<ExploreResult, "y" | "yUnit">) => (r.y === "sleepMin" ? minutesToHm(v) : r.y.startsWith("rating:") ? `${fmtNum(v, 1)}/10` : `${fmtNum(v, Math.abs(v) >= 100 ? 0 : 1)} ${r.yUnit}`.trim());

export function Explore() {
  const [days, setDays] = useState("90");
  const to = todayLocal();
  const from = addDays(to, -Number(days));
  const [opts, setOpts] = useState<ExploreOptions | null>(null);
  const [found, setFound] = useState<ExploreResult[] | null>(null);
  const [x, setX] = useState("");
  const [y, setY] = useState("sleepMin");
  const [after, setAfter] = useState("");
  const [lag, setLag] = useState("1");
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOpts(null);
    setFound(null);
    api.explore.options(from, to).then(setOpts).catch((e) => setErr(e.message));
    api.explore.discover(from, to).then(setFound).catch(() => setFound([]));
  }, [from, to]);

  useEffect(() => {
    if (!opts) return;
    if (!x || !opts.x.some((o) => o.value === x)) {
      const events = opts.x.filter((o) => o.group === "Words" || o.group === "Things you logged" || o.group === "Categories");
      const most = Math.max(1, ...events.map((o) => o.count));
      const balanced = events.filter((o) => o.count >= 3 && o.count <= most * 0.8);
      setX((balanced.find((o) => /coffee|caffeine|alcohol|beer|wine/i.test(o.label)) ?? balanced[0] ?? opts.x[0])?.value ?? "");
    }
    if (!opts.y.some((o) => o.value === y) && opts.y[0]) setY(opts.y[0].value);
  }, [opts]); // eslint-disable-line react-hooks/exhaustive-deps

  const eventX = /^(cat|text|title|tag|data):/.test(x);
  useEffect(() => {
    if (!x || !y) return;
    setBusy(true);
    setErr(null);
    api.explore
      .run({ from, to, x, y, lag: Number(lag), after: eventX && after ? Number(after) : null })
      .then(setResult)
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [from, to, x, y, lag, after, eventX]);

  const xOptions: SelectOption[] = useMemo(() => (opts?.x ?? []).map((o) => ({ value: o.value, label: o.label, group: o.group, hint: `${o.count} day${o.count === 1 ? "" : "s"}` })), [opts]);
  const yOptions: SelectOption[] = useMemo(() => (opts?.y ?? []).map((o) => ({ value: o.value, label: o.label, hint: `${o.count} days of data` })), [opts]);

  return (
    <div>
      <PageTitle
        title="Does X affect Y?"
        subtitle="Compare the days you did something with the days you didn't, and see whether your sleep, heart or energy moved with it."
        actions={
          <div className="w-44">
            <Select value={days} onChange={setDays} options={RANGES} aria-label="Date range" />
          </div>
        }
      />

      {opts == null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : opts.x.length === 0 || opts.y.length === 0 ? (
        <Empty icon={GitCompareArrows} title="Not enough to compare yet" body="Log your days and bring in Apple Health data. After a couple of weeks of both, this page can start answering questions." />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2 text-[15px]">
                <span className="text-ink-2">Does</span>
                <div className="w-full sm:w-64">
                  <Select value={x} onChange={setX} options={xOptions} searchable aria-label="Cause" />
                </div>
                {eventX && (
                  <div className="w-40">
                    <Select value={after} onChange={setAfter} options={AFTER} aria-label="Time of day" />
                  </div>
                )}
                <span className="text-ink-2">affect my</span>
                <div className="w-48">
                <Select
                  value={y}
                  onChange={(v) => {
                    setY(v);
                    const d = opts.y.find((o) => o.value === v)?.defaultLag;
                    if (d != null) setLag(String(d));
                  }}
                  options={yOptions}
                  aria-label="Outcome"
                />
                </div>
                <div className="w-56">
                  <Select value={lag} onChange={setLag} options={LAGS} aria-label="When" />
                </div>
                <span className="text-ink-2">?</span>
              </div>
            </Card>

            {err && <p className="text-sm text-bad">{err}</p>}
            {result && <ResultCard r={result} busy={busy} />}
          </div>

          <div>
            <SectionTitle aside={<Sparkles className="h-4 w-4 text-ink-3" />}>Patterns found</SectionTitle>
            {found == null ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : found.length === 0 ? (
              <Card className="p-4 text-sm text-ink-2">Nothing stands out clearly yet. Patterns show up here when a difference is strong enough that chance is an unlikely explanation.</Card>
            ) : (
              <div className="space-y-2">
                {found.map((f) => (
                  <button
                    key={`${f.x}|${f.y}`}
                    className="card w-full p-4 text-left transition-colors hover:bg-paper-2"
                    onClick={() => {
                      setX(f.x);
                      setY(f.y);
                      setLag(String(f.lag));
                      setAfter("");
                    }}
                  >
                    <div className="text-sm font-medium">
                      {f.xLabel} → {f.yLabel}
                    </div>
                    <p className="mt-1 text-xs text-ink-2">{f.summary}</p>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-ink-3">
              These are links in your own data, not proof of cause: days you train might also be days you sleep more for other reasons. Change one thing at a time and watch whether the pattern holds.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({ r, busy }: { r: ExploreResult; busy: boolean }) {
  const v = VERDICT[r.verdict];
  const means = r.groups.map((g) => g.mean).filter((m): m is number => m != null);
  const max = Math.max(...means, 0);
  return (
    <Card className={`p-5 transition-opacity ${busy ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="max-w-2xl text-lg font-semibold leading-snug tracking-tight">{r.summary}</h2>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${v.cls}`}>{v.label}</span>
      </div>

      <div className="mt-5 space-y-3">
        {r.groups.map((g, i) => (
          <div key={i}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="truncate text-ink-2">{g.label}</span>
              <span className="shrink-0 tabular-nums">
                {g.mean != null ? <span className="font-semibold">{fmtY(g.mean, r)}</span> : "—"} <span className="text-xs text-ink-3">· {g.n} days</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper-3">
              <div className="h-full rounded-full" style={{ width: `${g.mean != null && max ? Math.max(4, (g.mean / max) * 100) : 0}%`, background: "var(--series-1)", opacity: i === 0 ? 1 : 0.45 }} />
            </div>
          </div>
        ))}
      </div>

      {r.points.length > 0 && (
        <div className="mt-6">
          {r.kind === "binary" ? <Strip r={r} /> : <Scatter r={r} />}
        </div>
      )}

      {r.p != null && (
        <p className="mt-4 text-xs text-ink-3">
          Chance of a gap this big if {r.xLabel.toLowerCase()} made no difference: about {r.p < 0.01 ? "under 1%" : `${Math.round(r.p * 100)}%`}
          {r.r != null && ` · correlation ${r.r.toFixed(2)}`}. Worked out by shuffling your days 2,000 times.
        </p>
      )}
    </Card>
  );
}

/** Each day as a dot: with vs without, so you can see the spread, not just the averages. */
function Strip({ r }: { r: ExploreResult }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 120;
  const padL = 96;
  const ys = r.points.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const sx = (v: number) => padL + ((v - lo) / (hi - lo || 1)) * (W - padL - 16);
  const rows = [
    { label: "With", y: 34, pts: r.points.filter((p) => p.x === 1), mean: r.groups[0].mean },
    { label: "Without", y: 86, pts: r.points.filter((p) => p.x === 0), mean: r.groups[1].mean },
  ];
  return (
    <div ref={ref} className="w-full min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} className="block">
        {rows.map((row, ri) => (
          <g key={row.label}>
            <text x={0} y={row.y + 4} fontSize="12" fill="var(--ink-3)">
              {row.label}
            </text>
            <line x1={padL} x2={W - 16} y1={row.y} y2={row.y} stroke="var(--line)" />
            {row.pts.map((p, i) => (
              <circle key={i} cx={sx(p.y)} cy={row.y + ((i % 5) - 2) * 3} r={4} fill="var(--series-1)" opacity={ri === 0 ? 0.75 : 0.35}>
                <title>
                  {p.date}: {fmtY(p.y, r)}
                </title>
              </circle>
            ))}
            {row.mean != null && <line x1={sx(row.mean)} x2={sx(row.mean)} y1={row.y - 14} y2={row.y + 14} stroke="var(--ink)" strokeWidth={2} />}
          </g>
        ))}
        <text x={padL} y={H - 2} fontSize="11" fill="var(--ink-3)">
          {fmtY(lo, r)}
        </text>
        <text x={W - 16} y={H - 2} fontSize="11" fill="var(--ink-3)" textAnchor="end">
          {fmtY(hi, r)}
        </text>
      </svg>
    </div>
  );
}

function Scatter({ r }: { r: ExploreResult }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 220;
  const pad = { l: 56, r: 16, t: 10, b: 28 };
  const xs = r.points.map((p) => p.x);
  const ys = r.points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (v: number) => pad.l + ((v - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const sy = (v: number) => H - pad.b - ((v - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b);
  // Least-squares line, only when there's a real trend to draw.
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxx = xs.reduce((a, v) => a + (v - mx) ** 2, 0);
  const slope = sxx ? xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0) / sxx : 0;
  return (
    <div ref={ref} className="w-full min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} className="block">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line)" />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="var(--line)" />
        {r.points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4} fill="var(--series-1)" opacity={0.6}>
            <title>
              {p.date}: {fmtNum(p.x, 1)} → {fmtY(p.y, r)}
            </title>
          </circle>
        ))}
        {r.verdict !== "none" && r.verdict !== "not-enough" && <line x1={sx(x0)} x2={sx(x1)} y1={sy(my + slope * (x0 - mx))} y2={sy(my + slope * (x1 - mx))} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 4" />}
        <text x={pad.l - 6} y={sy(y1) + 4} fontSize="11" fill="var(--ink-3)" textAnchor="end">
          {fmtY(y1, r)}
        </text>
        <text x={pad.l - 6} y={sy(y0)} fontSize="11" fill="var(--ink-3)" textAnchor="end">
          {fmtY(y0, r)}
        </text>
        <text x={pad.l} y={H - 8} fontSize="11" fill="var(--ink-3)">
          {fmtNum(x0, 1)}
        </text>
        <text x={W - pad.r} y={H - 8} fontSize="11" fill="var(--ink-3)" textAnchor="end">
          {fmtNum(x1, 1)} {r.xLabel.toLowerCase()}
        </text>
      </svg>
    </div>
  );
}
