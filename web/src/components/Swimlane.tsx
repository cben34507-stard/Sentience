import { useMemo, useState } from "react";
import { EVENT_CATEGORY_META } from "@sentience/shared";
import type { TimelineDay } from "../lib/api";
import { fmtTime, weekday } from "../lib/date";
import { useWidth } from "./Charts";
import { CATEGORY_GROUPS, CATEGORY_GROUP_COLOR, CategoryIcon } from "./icons";

interface Hover {
  x: number;
  y: number;
  title: string;
  sub: string;
  category?: TimelineDay["events"][number]["category"];
}

/**
 * Several days stacked as timelines: each row is one day, 00:00 → 24:00.
 * Grey spans are sleep, dots and bars are events coloured by group, and the
 * thin strip under each row is heart rate (darker = higher).
 */
export function Swimlane({ days }: { days: TimelineDay[] }) {
  const [wrap, W] = useWidth<HTMLDivElement>(900);
  const [hover, setHover] = useState<Hover | null>(null);
  const labelW = 74;
  const rowH = days.length > 16 ? 22 : 30;
  const gap = days.length > 16 ? 4 : 6;
  const top = 22;
  const H = top + days.length * (rowH + gap) + 4;
  const plotW = Math.max(100, W - labelW - 8);

  const allSleep = useMemo(() => days.flatMap((d) => d.sleep.map((s) => [Date.parse(s.startAt), Date.parse(s.endAt)] as const)), [days]);
  const hrRange = useMemo(() => {
    const v = days.flatMap((d) => d.heartRateByHour.filter((x): x is number => x != null));
    return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
  }, [days]);

  const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="relative w-full min-w-0" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} className="block select-none" role="img" aria-label="Days stacked as timelines">
        {hours.map((h) => {
          const x = labelW + (h / 24) * plotW;
          return (
            <g key={h}>
              <line x1={x} x2={x} y1={top - 4} y2={H} stroke="var(--line)" strokeWidth={h % 12 === 0 ? 1 : 0.6} />
              <text x={x} y={12} textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"} fontSize="11" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
                {String(h % 24).padStart(2, "0")}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const y = top + i * (rowH + gap);
          const s0 = Date.parse(d.range.start);
          const s1 = Date.parse(d.range.end);
          const xOf = (t: number) => labelW + ((t - s0) / (s1 - s0)) * plotW;
          const evH = Math.max(6, rowH * 0.32);
          return (
            <g key={d.date}>
              <text x={0} y={y + rowH / 2 + 4} fontSize="12" fill="var(--ink-2)" style={{ fontFamily: "inherit", fontWeight: 500 }}>
                {weekday(d.date)} {d.date.slice(8)}
              </text>
              <rect x={labelW} y={y} width={plotW} height={rowH} rx={6} fill="var(--paper-2)" />
              {/* sleep spans clipped to this day */}
              {allSleep.map(([a, b], k) => {
                const ca = Math.max(a, s0);
                const cb = Math.min(b, s1);
                if (cb <= ca) return null;
                return <rect key={k} x={xOf(ca)} y={y} width={Math.max(1, xOf(cb) - xOf(ca))} height={rowH} rx={6} fill="var(--ink-3)" opacity={0.2} />;
              })}
              {/* heart-rate strip */}
              {d.heartRateByHour.map((v, h) => {
                if (v == null) return null;
                const frac = (v - hrRange[0]) / (hrRange[1] - hrRange[0] || 1);
                return <rect key={h} x={labelW + (h / 24) * plotW + 0.5} y={y + rowH - 3} width={plotW / 24 - 1} height={3} rx={1.5} fill="var(--series-1)" opacity={0.15 + frac * 0.85} />;
              })}
              {/* events */}
              {d.events.map((e) => {
                const a = Date.parse(e.startAt);
                const x = xOf(a);
                const color = CATEGORY_GROUP_COLOR[e.category];
                const cy = y + rowH / 2 - 1;
                const enter = () =>
                  setHover({
                    x: x / W,
                    y,
                    title: e.title,
                    sub: `${EVENT_CATEGORY_META[e.category].label} · ${fmtTime(e.startAt)}${e.endAt ? `–${fmtTime(e.endAt)}` : ""}${e.rating != null ? ` · ${e.rating}/10` : ""}`,
                    category: e.category,
                  });
                if (e.endAt) {
                  const x2 = Math.min(labelW + plotW, xOf(Date.parse(e.endAt)));
                  return (
                    <g key={e.id} onMouseEnter={enter} onMouseLeave={() => setHover(null)}>
                      <rect x={x} y={y} width={Math.max(10, x2 - x)} height={rowH} fill="transparent" />
                      <rect x={x} y={cy - evH / 2} width={Math.max(4, x2 - x)} height={evH} rx={evH / 2} fill={color} opacity={0.9} />
                    </g>
                  );
                }
                return (
                  <g key={e.id} onMouseEnter={enter} onMouseLeave={() => setHover(null)}>
                    <rect x={x - 7} y={y} width={14} height={rowH} fill="transparent" />
                    <circle cx={x} cy={cy} r={Math.min(4.5, rowH * 0.17)} fill={color} stroke="var(--paper)" strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-pop"
          style={{ left: `${hover.x * 100}%`, top: hover.y - 6 }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            {hover.category && <CategoryIcon category={hover.category} className="h-3.5 w-3.5" />}
            {hover.title}
          </div>
          <div className="text-ink-3">{hover.sub}</div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {CATEGORY_GROUPS.map((g) => (
          <span key={g.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
            {g.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-ink-3/30" />
          Sleep
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--series-1) 20%, transparent), var(--series-1))" }} />
          Heart rate, low to high
        </span>
      </div>
    </div>
  );
}
