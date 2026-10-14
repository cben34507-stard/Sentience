import { useState } from "react";
import { labFlag, type LabFlag, type LabResult } from "@sentience/shared";
import { useWidth } from "./Charts";

export function rangeText(r: Pick<LabResult, "refLow" | "refHigh">): string {
  if (r.refLow != null && r.refHigh != null) return `${r.refLow}–${r.refHigh}`;
  if (r.refLow != null) return `≥ ${r.refLow}`;
  if (r.refHigh != null) return `≤ ${r.refHigh}`;
  return "no range";
}


export function FlagDot({ flag }: { flag: LabFlag }) {
  return <span className={`h-2 w-2 rounded-full ${flag === "normal" ? "bg-good" : flag === "unknown" ? "bg-ink-3" : "bg-warn"}`} />;
}
export function FlagBadge({ flag }: { flag: LabFlag }) {
  if (flag === "unknown") return null;
  const cls = flag === "normal" ? "bg-good/12 text-good" : "bg-warn/15 text-warn";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{flag === "normal" ? "in range" : flag}</span>;
}


/** Tiny trend for list rows. */
export function Spark({ results }: { results: LabResult[] }) {
  const vals = results.filter((r) => r.value != null);
  if (vals.length < 2) return <span className="w-16" />;
  const ys = vals.map((r) => r.value!);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pts = vals.map((r, i) => `${(i / (vals.length - 1)) * 60},${18 - ((r.value! - lo) / (hi - lo || 1)) * 16}`).join(" ");
  return (
    <svg width="64" height="20" viewBox="-2 0 64 20" className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--series-1)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}


/** Value over time, with the reference range as a soft band. */
export function LabTrend({ results }: { results: LabResult[] }) {
  const [wrap, W] = useWidth<HTMLDivElement>(600);
  const [hover, setHover] = useState<number | null>(null);
  const pts = results.filter((r) => r.value != null);
  const H = 220;
  const padL = 44;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  if (pts.length === 0) return <div className="py-8 text-center text-sm text-ink-3">No numeric values to chart</div>;
  const latest = pts[pts.length - 1];
  const vals = pts.map((p) => p.value!);
  const lo0 = Math.min(...vals, latest.refLow ?? Infinity);
  const hi0 = Math.max(...vals, latest.refHigh ?? -Infinity);
  const pad = (hi0 - lo0) * 0.15 || Math.abs(hi0) * 0.1 || 1;
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const t0 = Date.parse(pts[0].takenAt);
  const t1 = Date.parse(latest.takenAt);
  const span = t1 - t0 || 86_400_000;
  const x = (t: string) => (pts.length === 1 ? padL + (W - padL - padR) / 2 : padL + ((Date.parse(t) - t0) / span) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [lo0, (lo0 + hi0) / 2, hi0].map((v) => Math.round(v * 10) / 10);
  const bandTop = latest.refHigh != null ? y(latest.refHigh) : padT;
  const bandBot = latest.refLow != null ? y(latest.refLow) : H - padB;
  const hasBand = latest.refLow != null || latest.refHigh != null;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.takenAt).toFixed(1)} ${y(p.value!).toFixed(1)}`).join(" ");
  const hp = hover != null ? pts[hover] : null;

  return (
    <div className="relative w-full min-w-0" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} className="block select-none" role="img" aria-label="Result over time">
        {hasBand && <rect x={padL} y={bandTop} width={W - padL - padR} height={Math.max(0, bandBot - bandTop)} fill="var(--good)" opacity={0.08} rx={4} />}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
              {v}
            </text>
          </g>
        ))}
        {pts.length > 1 && <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => {
          const f = labFlag(p);
          return (
            <g key={p.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(p.takenAt)} cy={y(p.value!)} r={14} fill="transparent" />
              <circle cx={x(p.takenAt)} cy={y(p.value!)} r={hover === i ? 6 : 4.5} fill={f === "low" || f === "high" ? "var(--warn)" : "var(--series-1)"} stroke="var(--paper)" strokeWidth={2} />
            </g>
          );
        })}
        {[pts[0], latest].filter((p, i, a) => a.indexOf(p) === i).map((p) => (
          <text key={p.id} x={x(p.takenAt)} y={H - 8} textAnchor={p === latest && pts.length > 1 ? "end" : "start"} fontSize="11" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
            {p.takenAt.slice(0, 10)}
          </text>
        ))}
      </svg>
      {hp && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs shadow-soft" style={{ left: `${(x(hp.takenAt) / W) * 100}%`, top: y(hp.value!) - 10 }}>
          <span className="font-semibold tabular-nums">
            {hp.value} {hp.unit}
          </span>
          <span className="ml-2 text-ink-3">{hp.takenAt.slice(0, 10)}</span>
        </div>
      )}
      {hasBand && <div className="mt-1 text-xs text-ink-3">Shaded band: reference range on your latest report.</div>}
    </div>
  );
}

