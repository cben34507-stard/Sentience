import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Event, EventCategory, EventInput } from "@sentience/shared";
import { EVENT_CATEGORY_META } from "@sentience/shared";
import { api, type DayView } from "../lib/api";
import { addDays, durationMin, fmtDateLong, fmtNum, fmtTime, minutesToHm, todayLocal, toLocalIso } from "../lib/date";
import { Card, Empty, Ring, SectionTitle, Spinner, Stat, useToast } from "../components/ui";
import { HeartRateChart, StepsChart } from "../components/Charts";
import { EventForm } from "../components/EventForm";
import { CATEGORY_TINT } from "../components/categories";

const QUICK: { label: string; category: EventCategory; title: string; icon: string }[] = [
  { label: "Woke up", category: "wake", title: "Woke up", icon: "☀️" },
  { label: "Teeth", category: "hygiene", title: "Brushed teeth", icon: "🪥" },
  { label: "Breakfast", category: "meal", title: "Breakfast", icon: "🍳" },
  { label: "Vitamins", category: "supplement", title: "Vitamins", icon: "💊" },
  { label: "Coffee", category: "drink", title: "Coffee", icon: "☕" },
  { label: "Water", category: "drink", title: "Water", icon: "💧" },
  { label: "Left house", category: "movement", title: "Left the house", icon: "🚪" },
  { label: "Back home", category: "movement", title: "Got back home", icon: "🏠" },
  { label: "Lunch", category: "meal", title: "Lunch", icon: "🥪" },
  { label: "Dinner", category: "meal", title: "Dinner", icon: "🍝" },
  { label: "Workout", category: "workout", title: "Workout", icon: "🏋️" },
  { label: "Mood", category: "mood", title: "Mood check", icon: "🧠" },
  { label: "Bed", category: "sleep", title: "Went to bed", icon: "🌙" },
];

export function Today() {
  const [params, setParams] = useSearchParams();
  const date = params.get("date") ?? todayLocal();
  const setDate = (d: string) => setParams(d === todayLocal() ? {} : { date: d });

  const [day, setDay] = useState<DayView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; initial: Partial<Event> | null }>({ open: false, initial: null });
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDay(await api.day(date));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const isToday = date === todayLocal();

  /** For a past date, quick-log at midday-ish rather than "now". */
  const defaultStart = () => {
    if (isToday) return new Date();
    const d = new Date(`${date}T12:00:00`);
    return d;
  };

  const save = async (input: EventInput, id?: string) => {
    if (id) await api.events.update(id, input);
    else await api.events.create({ ...input, source: "web" });
    toast(id ? "Updated" : "Logged");
    await load();
  };
  const remove = async (id: string) => {
    await api.events.remove(id);
    toast("Deleted");
    await load();
  };

  const quick = (q: (typeof QUICK)[number]) => {
    setForm({
      open: true,
      initial: { category: q.category, title: q.title, startAt: toLocalIso(defaultStart()) },
    });
  };

  const h = day?.health ?? null;

  return (
    <div>
      {/* Date nav */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">
            {isToday ? "Today" : "Timeline"}
            {!isToday && (
              <button className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] tracking-normal text-ink-2 hover:text-ink" onClick={() => setDate(todayLocal())}>
                Jump to today
              </button>
            )}
          </div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em] sm:text-[32px]">{fmtDateLong(date)}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-outline h-10 w-10 p-0" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <input type="date" className="field h-10 w-auto py-0" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn-outline h-10 w-10 p-0" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Next day">
            ›
          </button>
          <button className="btn-primary ml-2 h-10" onClick={() => setForm({ open: true, initial: { startAt: toLocalIso(defaultStart()) } })}>
            <span className="text-base leading-none">+</span> Log
          </button>
        </div>
      </div>

      {/* Quick chips */}
      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {QUICK.map((q) => (
          <button key={q.label} className="chip shrink-0" onClick={() => quick(q)}>
            <span aria-hidden>{q.icon}</span> {q.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{error} — is the server running?</div>}

      {/* Health strip */}
      <Card className="mb-6 p-5">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Steps" value={fmtNum(h?.steps)} />
          <Stat label="Sleep" value={minutesToHm(h?.sleepMin)} />
          <Stat label="Resting HR" value={fmtNum(h?.restingHr)} unit="bpm" />
          <Stat label="HR range" value={h?.hrMin != null ? `${fmtNum(h.hrMin)}–${fmtNum(h.hrMax)}` : "—"} unit="bpm" />
          <Stat label="HRV" value={fmtNum(h?.hrvAvg)} unit="ms" />
          <Stat label="Active" value={fmtNum(h?.activeKcal)} unit="kcal" />
          <Stat label="Workouts" value={h?.workouts.length ?? 0} hint={h?.workouts.map((w) => w.activityType).join(", ")} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Timeline */}
        <div className="order-2 min-w-0 lg:order-1">
          <SectionTitle aside={<span className="text-xs text-ink-3">{day?.events.length ?? 0} events</span>}>Timeline</SectionTitle>
          {loading && !day ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : day && day.events.length === 0 ? (
            <Empty icon="🕊️" title="Nothing logged yet" body="Use the quick chips above or hit Log. Everything you add shows up here against your heart rate." />
          ) : (
            <Timeline events={day?.events ?? []} onEdit={(e) => setForm({ open: true, initial: e })} />
          )}
        </div>

        {/* Body */}
        <div className="order-1 min-w-0 space-y-6 lg:order-2">
          <Card className="p-5">
            <SectionTitle aside={<span className="text-xs text-ink-3">ticks = events</span>}>Heart rate</SectionTitle>
            {day ? <HeartRateChart points={day.heartRate} events={day.events} range={day.range} /> : <div style={{ height: 180 }} />}
            <div className="mt-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Steps per hour</div>
              <StepsChart byHour={day?.stepsByHour ?? Array(24).fill(null)} />
            </div>
          </Card>

          {day && day.goals.length > 0 && (
            <Card className="p-5">
              <SectionTitle>Goals</SectionTitle>
              <ul className="space-y-3">
                {day.goals.map((g) => (
                  <li key={g.goal.id} className="flex items-center gap-3">
                    <Ring percent={g.percent} size={40} stroke={4}>
                      {g.complete ? "✓" : `${Math.round(g.percent * 100)}`}
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{g.goal.title}</div>
                      <div className="text-xs text-ink-3">
                        {fmtNum(g.current, 1)} / {fmtNum(g.target, 1)} {g.goal.unit} · {g.goal.cadence}
                        {g.streak > 0 && ` · 🔥 ${g.streak}`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <SectionTitle>Hand this day to an analyst</SectionTitle>
            <p className="mb-3 text-sm text-ink-2">Export everything above as prompt-ready Markdown or raw JSON. Paste it into Claude and ask what to improve.</p>
            <div className="flex flex-wrap gap-2">
              <CopyMd from={date} to={date} />
              <a className="btn-outline" href={api.exportUrl(date, date, "md")}>
                Download .md
              </a>
              <a className="btn-outline" href={api.exportUrl(date, date, "json")}>
                Download .json
              </a>
            </div>
          </Card>
        </div>
      </div>

      <EventForm open={form.open} initial={form.initial} onClose={() => setForm((f) => ({ ...f, open: false }))} onSave={save} onDelete={remove} />
    </div>
  );
}

export function CopyMd({ from, to }: { from: string; to: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const md = await api.exportMarkdown(from, to);
          await navigator.clipboard.writeText(md);
          toast("Copied — paste it into your chat");
        } catch {
          toast("Clipboard blocked; use Download instead", "err");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner className="border-paper/40 border-t-paper" /> : "📋"} Copy for analysis
    </button>
  );
}

function Timeline({ events, onEdit }: { events: Event[]; onEdit: (e: Event) => void }) {
  const groups = useMemo(() => {
    const g: { label: string; items: Event[] }[] = [];
    for (const e of events) {
      const hour = new Date(e.startAt).getHours();
      const label = hour < 5 ? "Night" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Night";
      const last = g[g.length - 1];
      if (last && last.label === label) last.items.push(e);
      else g.push({ label, items: [e] });
    }
    return g;
  }, [events]);

  return (
    <div className="relative">
      <div className="absolute bottom-2 left-[62px] top-2 w-px bg-line sm:left-[70px]" />
      <AnimatePresence initial={false}>
        {groups.map((g, gi) => (
          <div key={`${g.label}-${gi}`} className="mb-5">
            <div className="mb-2 pl-[80px] text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 sm:pl-[88px]">{g.label}</div>
            <ul className="space-y-2">
              {g.items.map((e) => {
                const meta = EVENT_CATEGORY_META[e.category];
                return (
                  <motion.li key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-stretch gap-3">
                    <div className="w-[52px] shrink-0 pt-3 text-right text-xs font-medium tabular-nums text-ink-3 sm:w-[60px]">{fmtTime(e.startAt)}</div>
                    <div className="relative flex w-5 shrink-0 justify-center pt-3.5">
                      <span className="h-2.5 w-2.5 rounded-full ring-4 ring-paper" style={{ background: CATEGORY_TINT[e.category] }} />
                    </div>
                    <button onClick={() => onEdit(e)} className="card flex-1 px-4 py-3 text-left transition hover:border-line-2 hover:shadow-pop">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span aria-hidden>{meta.icon}</span>
                            <span className="truncate font-medium">{e.title}</span>
                            {e.rating != null && <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[11px] font-semibold tabular-nums">{e.rating}/10</span>}
                          </div>
                          <div className="mt-0.5 text-xs text-ink-3">
                            {meta.label}
                            {e.endAt && ` · ${minutesToHm(durationMin(e.startAt, e.endAt))} → ${fmtTime(e.endAt)}`}
                            {e.source !== "web" && ` · from ${e.source}`}
                          </div>
                        </div>
                        {e.tags.length > 0 && (
                          <div className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex">
                            {e.tags.slice(0, 3).map((t) => (
                              <span key={t} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-2">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {e.notes && <p className="mt-2 line-clamp-3 text-sm text-ink-2">{e.notes}</p>}
                      {Object.keys(e.data ?? {}).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-ink-3">
                          {Object.entries(e.data).map(([k, v]) => (
                            <span key={k}>
                              {k}=<span className="text-ink-2">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
