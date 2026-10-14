import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, type LucideIcon } from "lucide-react";
import { EVENT_CATEGORY_META, labFlag, type Event, type LabResult } from "@sentience/shared";
import type { DayView } from "../lib/api";
import { drawStrands, prefersReducedMotion } from "../lib/strands";
import { fmtTime, minutesToHm, durationMin } from "../lib/date";
import { useWidth } from "./Charts";
import { CATEGORY_GROUP_COLOR, CATEGORY_ICON } from "./icons";

interface Node {
  key: string;
  at: number;
  end?: number;
  title: string;
  sub: string;
  color: string;
  icon: LucideIcon;
  event?: Event;
  side: 1 | -1;
  level: number;
  /** All events in this group (more than one when they're close in time). */
  items: Omit<Node, "side" | "level" | "items" | "flip">[];
  flip?: boolean;
}

/**
 * The home-page timeline. The strands run across the day from midnight to
 * midnight; their energy follows your heart rate and they go quiet while you
 * sleep. Every event branches out of the timeline as a point.
 */
export function DayStrand({ day, isDark, onEdit }: { day: DayView; isDark: boolean; onEdit: (e: Event) => void }) {
  const [wrap, W] = useWidth<HTMLDivElement>(1000);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Node | null>(null);
  const [pinned, setPinned] = useState<Node | null>(null);
  const shown = pinned ?? hover;
  const mobile = W < 640;
  const H = mobile ? 300 : 360;
  const cy = H / 2 - 6;
  const padX = mobile ? 14 : 28;
  const t0 = Date.parse(day.range.start);
  const t1 = Date.parse(day.range.end);
  const now = Date.now();
  const isToday = now >= t0 && now < t1;
  const xOf = (t: number) => padX + ((t - t0) / (t1 - t0)) * (W - padX * 2);

  // Energy profile across the day: heart rate (normalised) with sleep damping.
  const energy = useMemo(() => {
    const bins = 96;
    const sum = new Float32Array(bins);
    const cnt = new Float32Array(bins);
    for (const p of day.heartRate) {
      const b = Math.floor(((Date.parse(p.t) - t0) / (t1 - t0)) * bins);
      if (b >= 0 && b < bins) {
        sum[b] += p.v;
        cnt[b] += 1;
      }
    }
    const vals: (number | null)[] = Array.from(sum, (s, i) => (cnt[i] ? s / cnt[i] : null));
    const known = vals.filter((v): v is number => v != null);
    const lo = known.length ? Math.min(...known) : 0;
    const hi = known.length ? Math.max(...known) : 1;
    // Fill gaps by carrying neighbours, then smooth.
    let lastV = known[0] ?? null;
    const filled = vals.map((v) => (v == null ? lastV : (lastV = v)));
    const norm = filled.map((v) => (v == null ? 0.55 : (v - lo) / (hi - lo || 1)));
    const sleep = day.sleep.map((s) => [Date.parse(s.startAt), Date.parse(s.endAt)] as const);
    const raw = norm.map((v, i) => {
      const t = t0 + ((i + 0.5) / bins) * (t1 - t0);
      const asleep = sleep.some(([a, b]) => t >= a && t < b);
      const future = isToday && t > now;
      let m = known.length ? 0.38 + 0.9 * v : 0.75;
      if (asleep) m = 0.22 + 0.15 * v;
      if (future) m = 0.18;
      return m;
    });
    // Smooth so waking up or a workout swells the strands instead of stepping.
    return raw.map((_, i) => {
      let a = 0;
      let w = 0;
      for (let k = -6; k <= 6; k++) {
        const j = i + k;
        if (j < 0 || j >= bins) continue;
        const wk = 1 - Math.abs(k) / 7;
        a += raw[j] * wk;
        w += wk;
      }
      return a / w;
    });
  }, [day.heartRate, day.sleep, t0, t1, isToday, now]);

  // Canvas loop, paused offscreen and in background tabs.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const reduce = prefersReducedMotion();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(c);
    let raf = 0;
    let t = 40;
    let last = performance.now();
    let lastDraw = 0;
    const span = W - padX * 2;
    const ampAt = (s: number) => energy[Math.min(energy.length - 1, Math.floor(s * energy.length))];
    const frame = (nowTs: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden || nowTs - lastDraw < 33) return;
      const dt = Math.min(0.05, (nowTs - last) / 1000);
      last = nowTs;
      lastDraw = nowTs;
      if (!reduce) t += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawStrands(ctx, { x0: padX, span, cy, amp: mobile ? 62 : 92, ampAt, pinch: 0.2, alpha: 0.9, t, strands: mobile ? 14 : 20, ribbons: 2, step: mobile ? 8 : 6, dark: isDark });
      if (isToday) {
        // The rest of today hasn't happened yet: fade it.
        const nx = padX + ((now - t0) / (t1 - t0)) * span;
        ctx.globalCompositeOperation = "destination-out";
        const g = ctx.createLinearGradient(nx, 0, nx + 60, 0);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.65)");
        ctx.fillStyle = g;
        ctx.fillRect(nx, 0, W - nx, H);
        ctx.globalCompositeOperation = "source-over";
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [W, H, cy, padX, energy, isDark, isToday, mobile, now, t0, t1]);

  // Group events that would sit on top of each other, then lay groups out in
  // lanes above and below the timeline so labels never collide.
  const nodes = useMemo(() => {
    const raw: (Omit<Node, "side" | "level" | "items">)[] = [
      ...day.events.map((e) => ({
        key: e.id,
        at: Date.parse(e.startAt),
        end: e.endAt ? Date.parse(e.endAt) : undefined,
        title: e.title,
        sub: `${EVENT_CATEGORY_META[e.category].label} · ${fmtTime(e.startAt)}${e.endAt ? ` – ${fmtTime(e.endAt)} (${minutesToHm(durationMin(e.startAt, e.endAt))})` : ""}${e.rating != null ? ` · ${e.rating}/10` : ""}`,
        color: CATEGORY_GROUP_COLOR[e.category],
        icon: CATEGORY_ICON[e.category],
        event: e,
      })),
      ...day.labResults.map((l: LabResult) => ({
        key: `lab-${l.id}`,
        at: Date.parse(l.takenAt),
        title: `${l.name}: ${l.value ?? l.valueText} ${l.unit}`,
        sub: `Test result · ${fmtTime(l.takenAt)}${labFlag(l) === "low" || labFlag(l) === "high" ? ` · ${labFlag(l).toUpperCase()}` : ""}`,
        color: "var(--ink)",
        icon: FlaskConical,
      })),
    ].sort((a, b) => a.at - b.at);

    const minGap = mobile ? 30 : 34;
    const groups: (typeof raw)[] = [];
    for (const n of raw) {
      const g = groups[groups.length - 1];
      if (g && xOf(n.at) - xOf(g[0].at) < minGap) g.push(n);
      else groups.push([n]);
    }

    const levels = mobile ? 3 : 4;
    const edge: Record<string, number> = {};
    return groups.map((g, i) => {
      const first = g[0];
      const title = g.length > 1 ? `${first.title} +${g.length - 1}` : first.title;
      const x = xOf(first.at);
      const labelW = mobile ? 0 : Math.min(150, 12 + title.length * 6.2);
      const flip = x > W - 190;
      const left = flip ? x - 20 - labelW : x - 20;
      const right = flip ? x + 20 : x + 20 + labelW;
      const preferred: 1 | -1 = i % 2 === 0 ? -1 : 1;
      let side: 1 | -1 = preferred;
      let level = levels - 1;
      for (let attempt = 0; attempt < levels * 2; attempt++) {
        const sd = (attempt % 2 === 0 ? preferred : -preferred) as 1 | -1;
        const lv = Math.floor(attempt / 2);
        const k = `${sd}:${lv}`;
        if (edge[k] == null || left > edge[k] + 6) {
          side = sd;
          level = lv;
          break;
        }
      }
      edge[`${side}:${level}`] = right;
      return { ...first, title, side, level, items: g, flip } as Node;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.events, day.labResults, W, mobile]);

  const stemFor = (level: number) => (mobile ? 50 : 66) + level * (mobile ? 34 : 36);
  const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height: H }}>
      <canvas ref={canvas} className="absolute inset-0" style={{ width: W, height: H }} aria-hidden />
      <svg className="absolute inset-0 overflow-visible" width={W} height={H} aria-hidden>
        {/* sleep and ranged events as soft bands along the timeline */}
        {day.sleep.map((s, i) => {
          const a = Math.max(t0, Date.parse(s.startAt));
          const b = Math.min(t1, Date.parse(s.endAt));
          if (b <= a) return null;
          return <rect key={`s${i}`} x={xOf(a)} y={cy - 4} width={xOf(b) - xOf(a)} height={8} rx={4} fill="var(--ink-3)" opacity={0.18} />;
        })}
        {nodes
          .filter((n) => n.end)
          .map((n) => (
            <rect key={`r${n.key}`} x={xOf(n.at)} y={cy - 3} width={Math.max(4, xOf(Math.min(n.end!, t1)) - xOf(n.at))} height={6} rx={3} fill={n.color} opacity={0.55} />
          ))}
        {nodes.map((n, i) => {
          const x = xOf(n.at);
          const y2 = cy + n.side * stemFor(n.level);
          return (
            <motion.line
              key={`l${n.key}${day.date}`}
              x1={x}
              x2={x}
              y1={cy}
              y2={y2}
              stroke={n.color}
              strokeWidth={1.4}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ delay: 0.15 + i * 0.045, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
        {nodes.map((n) => (
          <circle key={`o${n.key}`} cx={xOf(n.at)} cy={cy} r={3} fill={n.color} stroke="var(--paper)" strokeWidth={1.5} />
        ))}
        {isToday && (
          <g>
            <line x1={xOf(now)} x2={xOf(now)} y1={16} y2={H - 26} stroke="var(--ink-3)" strokeDasharray="3 4" />
            <text x={xOf(now) + 6} y={24} fontSize="11" fill="var(--ink-2)" style={{ fontFamily: "inherit", fontWeight: 600 }}>
              now
            </text>
          </g>
        )}
        {hours.map((h) => {
          const x = padX + (h / 24) * (W - padX * 2);
          return (
            <text key={h} x={x} y={H - 6} textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"} fontSize="11" fill="var(--ink-3)" style={{ fontFamily: "inherit" }}>
              {String(h % 24).padStart(2, "0")}
            </text>
          );
        })}
      </svg>

      {nodes.map((n, i) => {
        const x = xOf(n.at);
        const y = cy + n.side * stemFor(n.level);
        const Icon = n.icon;
        const right = !!n.flip;
        return (
          <motion.button
            key={`n${n.key}${day.date}`}
            type="button"
            className="group absolute flex items-center gap-2"
            style={{ left: Math.min(W - 18, Math.max(18, x)), top: y, transform: "translate(-50%, -50%)" }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 + i * 0.045, type: "spring", stiffness: 420, damping: 26 }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover((h) => (h?.key === n.key ? null : h))}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => {
              if (n.items.length === 1 && n.event) onEdit(n.event);
              else setPinned((p) => (p?.key === n.key ? null : n));
            }}
            aria-label={`${n.title}, ${n.sub}`}
          >
            <span
              className="relative grid h-8 w-8 place-items-center rounded-full border-2 bg-paper shadow-soft transition-transform group-hover:scale-110"
              style={{ borderColor: n.color }}
            >
              <Icon className="h-4 w-4 text-ink" strokeWidth={1.9} />
              {n.items.length > 1 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[9px] font-semibold text-paper">{n.items.length}</span>
              )}
            </span>
            {!mobile && (
              <span
                className={`pointer-events-none absolute top-1/2 max-w-[132px] -translate-y-1/2 truncate rounded-md bg-paper/80 px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight text-ink-2 backdrop-blur-sm ${right ? "right-10 text-right" : "left-10"}`}
              >
                {n.title}
              </span>
            )}
          </motion.button>
        );
      })}

      {shown && (
        <div
          className={`absolute z-10 w-max max-w-[280px] rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-pop ${pinned ? "" : "pointer-events-none"}`}
          style={{
            left: Math.min(W - 145, Math.max(145, xOf(shown.at))),
            top: shown.side === -1 ? cy + 18 : cy - 18,
            transform: `translate(-50%, ${shown.side === -1 ? "0" : "-100%"})`,
          }}
          onMouseLeave={() => setPinned(null)}
        >
          {shown.items.map((it) => (
            <button
              key={it.key}
              type="button"
              className="block w-full rounded-lg px-1 py-1 text-left hover:bg-paper-2"
              onClick={() => {
                if (it.event) onEdit(it.event);
                setPinned(null);
              }}
            >
              <div className="font-semibold text-ink">{it.title}</div>
              <div className="text-ink-3">{it.sub}</div>
              {shown.items.length === 1 && it.event?.notes && <div className="mt-1 line-clamp-2 text-ink-2">{it.event.notes}</div>}
            </button>
          ))}
          {shown.items.length > 1 && !pinned && <div className="mt-1 px-1 text-[10px] text-ink-3">Click to pick one</div>}
        </div>
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-x-0 top-[62%] text-center text-sm text-ink-3">Log something and it branches out of your day here.</div>
      )}
    </div>
  );
}
