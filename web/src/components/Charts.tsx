import { useEffect, useMemo, useRef, useState } from "react";

/** Measures the rendered width of a container so SVG text stays undistorted. */
export function useWidth<T extends HTMLElement>(fallback = 600): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(120, Math.round(entry.contentRect.width))));
    ro.observe(el);
    setW(Math.max(120, Math.round(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
import type { Event } from "@sentience/shared";
import { EVENT_CATEGORY_META } from "@sentience/shared";
import { fmtTime } from "../lib/date";

interface HRProps {
  points: { t: string; v: number }[];
  events: Event[];
  range: { start: string; end: string };
  height?: number;
}

/**
 * Heart rate across the day as a single thin line, with event markers along
 * the baseline so you can see what your body was doing when you did things.
 * Hover for a crosshair + tooltip.
 */
export function HeartRateChart({ points, events, range, height = 180 }: HRProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const padL = 34;
  const padR = 8;
  const padT = 10;
  const padB = 26;
  const t0 = Date.parse(range.start);
  const t1 = Date.parse(range.end);

  const { ys, path, area, min, max } = useMemo(() => {
    if (points.length === 0) return { ys: [] as number[], path: "", area: "", min: 0, max: 0 };
    const vals = points.map((p) => p.v);
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
    const hi = Math.ceil((Math.max(...vals) + 5) / 10) * 10;
    const x = (t: string) => padL + ((Date.parse(t) - t0) / (t1 - t0)) * (W - padL - padR);
    const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
    const a = `${d} L${x(points[points.length - 1].t).toFixed(1)} ${H - padB} L${x(points[0].t).toFixed(1)} ${H - padB} Z`;
    return { ys: [lo, Math.round((lo + hi) / 2), hi], path: d, area: a, min: lo, max: hi };
  }, [points, t0, t1, H, W]);

  const xOf = (t: number) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
  const yOf = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const svg = ref.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const px = ((clientX - rect.left) / rect.width) * W;
    const t = t0 + ((px - padL) / (W - padL - padR)) * (t1 - t0);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(Date.parse(points[i].t) - t);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const hp = hover != null ? points[hover] : null;

  return (
    <div className="relative w-full min-w-0 overflow-hidden" ref={wrapRef}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: H }}
        className="block touch-none select-none"
        onMouseMove={onMove}
        onTouchMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchEnd={() => setHover(null)}
        role="img"
        aria-label="Heart rate through the day"
      >
        {/* grid */}
        {ys.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 8} y={yOf(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
              {v}
            </text>
          </g>
        ))}
        {hours.map((h) => {
          const x = padL + (h / 24) * (W - padL - padR);
          return (
            <text key={h} x={x} y={H - 8} textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"} fontSize="11" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
              {String(h % 24).padStart(2, "0")}
            </text>
          );
        })}

        {points.length > 0 ? (
          <>
            <path d={area} fill="var(--series-1)" opacity="0.08" />
            <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
            No heart-rate data for this day
          </text>
        )}

        {/* event markers along the baseline */}
        {events.map((e) => {
          const x = xOf(Date.parse(e.startAt));
          if (x < padL || x > W - padR) return null;
          const x2 = e.endAt ? Math.min(W - padR, xOf(Date.parse(e.endAt))) : null;
          return (
            <g key={e.id}>
              {x2 != null && x2 > x && <rect x={x} y={padT} width={x2 - x} height={H - padT - padB} fill="var(--ink)" opacity="0.04" />}
              <line x1={x} x2={x} y1={H - padB} y2={H - padB - 10} stroke="var(--ink-2)" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* crosshair */}
        {hp && (
          <g>
            <line x1={xOf(Date.parse(hp.t))} x2={xOf(Date.parse(hp.t))} y1={padT} y2={H - padB} stroke="var(--ink-3)" strokeDasharray="3 3" />
            <circle cx={xOf(Date.parse(hp.t))} cy={yOf(hp.v)} r="5" fill="var(--series-1)" stroke="var(--paper)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs shadow-soft"
          style={{ left: `${(xOf(Date.parse(hp.t)) / W) * 100}%` }}
        >
          <span className="font-semibold tabular-nums">{hp.v} bpm</span>
          <span className="ml-2 text-ink-3">{fmtTime(hp.t)}</span>
          {nearestEvent(events, hp.t) && <div className="mt-0.5 text-ink-2">{nearestEvent(events, hp.t)}</div>}
        </div>
      )}
    </div>
  );
}

function nearestEvent(events: Event[], t: string): string | null {
  const tt = Date.parse(t);
  let best: Event | null = null;
  let bestD = 20 * 60_000;
  for (const e of events) {
    const d = Math.abs(Date.parse(e.startAt) - tt);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best ? `${EVENT_CATEGORY_META[best.category].label} · ${best.title}` : null;
}

/** Steps per hour as thin rounded bars. */
export function StepsChart({ byHour, height = 90 }: { byHour: (number | null)[]; height?: number }) {
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const padL = 34;
  const padR = 8;
  const padB = 6;
  const max = Math.max(1, ...byHour.map((v) => v ?? 0));
  const bw = (W - padL - padR) / 24;
  const hasAny = byHour.some((v) => v != null);
  return (
    <div className="relative w-full min-w-0 overflow-hidden" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} className="block select-none" role="img" aria-label="Steps per hour">
        <text x={padL - 8} y={12} textAnchor="end" fontSize="11" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
          {max >= 1000 ? `${(max / 1000).toFixed(1)}k` : max}
        </text>
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--line)" />
        {!hasAny && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
            No step data
          </text>
        )}
        {byHour.map((v, h) => {
          const val = v ?? 0;
          const bh = (val / max) * (H - padB - 14);
          const x = padL + h * bw + 2;
          return (
            <g key={h} onMouseEnter={() => setHover(h)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={0} width={bw - 4} height={H} fill="transparent" />
              {val > 0 && <rect x={x} y={H - padB - bh} width={Math.max(2, bw - 4)} height={Math.max(2, bh)} rx="2" fill="var(--series-1)" opacity={hover === h ? 1 : 0.85} />}
            </g>
          );
        })}
      </svg>
      {hover != null && byHour[hover] != null && (
        <div className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-lg border border-line bg-paper px-2 py-1 text-xs shadow-soft" style={{ left: `${((padL + hover * bw + bw / 2) / W) * 100}%` }}>
          <span className="font-semibold tabular-nums">{byHour[hover]!.toLocaleString()}</span> <span className="text-ink-3">steps · {String(hover).padStart(2, "0")}:00</span>
        </div>
      )}
    </div>
  );
}

/** Generic small bar chart for the review page: one value per day. */
export function DayBars({ values, labels, format, height = 110 }: { values: (number | null)[]; labels: string[]; format: (v: number) => string; height?: number }) {
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const padB = 20;
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const n = values.length;
  const bw = W / n;
  return (
    <div className="relative w-full min-w-0 overflow-hidden" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} className="block select-none" role="img">
        <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="var(--line)" />
        {values.map((v, i) => {
          const val = v ?? 0;
          const bh = (val / max) * (H - padB - 10);
          const x = i * bw + Math.min(6, bw * 0.15);
          const w = bw - Math.min(12, bw * 0.3);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {v != null && <rect x={x} y={H - padB - bh} width={w} height={Math.max(2, bh)} rx="3" fill="var(--series-1)" opacity={hover === i ? 1 : 0.85} />}
              {n <= 16 && (
                <text x={i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize="11" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && values[hover] != null && (
        <div className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-lg border border-line bg-paper px-2 py-1 text-xs shadow-soft" style={{ left: `${((hover * bw + bw / 2) / W) * 100}%` }}>
          <span className="font-semibold tabular-nums">{format(values[hover]!)}</span> <span className="text-ink-3">{labels[hover]}</span>
        </div>
      )}
    </div>
  );
}
