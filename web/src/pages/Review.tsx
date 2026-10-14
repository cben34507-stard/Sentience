import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Download } from "lucide-react";
import { Swimlane } from "../components/Swimlane";
import { Insights } from "../components/Insights";
import { Link } from "react-router-dom";
import { api, type Overview, type TimelineDay } from "../lib/api";
import { addDays, fmtDateShort, fmtNum, minutesToHm, todayLocal, weekday } from "../lib/date";
import { Card, Empty, PageTitle, SectionTitle, Spinner, Stat } from "../components/ui";
import { DayBars } from "../components/Charts";
import { CopyMd } from "./Today";

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

export function Review() {
  const today = todayLocal();
  const [to, setTo] = useState(today);
  const [from, setFrom] = useState(addDays(today, -6));
  const [data, setData] = useState<Overview | null>(null);
  const [lanes, setLanes] = useState<TimelineDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .timeline(from, to < addDays(from, 61) ? to : addDays(from, 61))
      .then((d) => !cancelled && setLanes(d.days))
      .catch(() => undefined);
    api
      .overview(from, to)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const days = data?.days ?? [];
  const labels = days.map((d) => (days.length <= 16 ? weekday(d.date) : d.date.slice(8)));
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const totals = useMemo(
    () => ({
      events: days.reduce((a, d) => a + d.eventCount, 0),
      loggedDays: days.filter((d) => d.eventCount > 0).length,
      steps: avg(days.map((d) => d.steps)),
      sleep: avg(days.map((d) => d.sleepMin)),
      rhr: avg(days.map((d) => d.restingHr)),
      mood: avg(days.map((d) => d.moodAvg)),
      workouts: days.reduce((a, d) => a + d.workouts, 0),
    }),
    [days],
  );

  const nDays = days.length;

  return (
    <div>
      <PageTitle
        title="Review"
        subtitle="Zoom out over a week or two. Spot the pattern, export it, and get it analysed."
        actions={
          <>
            {PRESETS.map((p) => (
              <button
                key={p.days}
                className={`chip ${to === today && from === addDays(today, -(p.days - 1)) ? "!border-ink !bg-ink !text-paper" : ""}`}
                onClick={() => {
                  setTo(today);
                  setFrom(addDays(today, -(p.days - 1)));
                }}
              >
                {p.label}
              </button>
            ))}
            <input type="date" className="field h-9 w-auto py-0 text-xs" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            <span className="text-ink-3">to</span>
            <input type="date" className="field h-9 w-auto py-0 text-xs" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{error}</div>}

      <Card className="mb-6 p-5">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Days logged" value={`${totals.loggedDays}/${nDays}`} />
          <Stat label="Events" value={totals.events} />
          <Stat label="Avg steps" value={fmtNum(totals.steps)} />
          <Stat label="Avg sleep" value={minutesToHm(totals.sleep)} />
          <Stat label="Avg resting HR" value={fmtNum(totals.rhr)} unit="bpm" />
          <Stat label="Avg mood" value={fmtNum(totals.mood, 1)} unit="/10" />
          <Stat label="Workouts" value={totals.workouts} />
        </div>
      </Card>

      <div className="mb-6">
        <Insights from={from} to={to} />
      </div>

      <Card className="mb-6 p-5">
        <SectionTitle aside={<span className="text-xs text-ink-3">hover any mark for details</span>}>Days as timelines</SectionTitle>
        {lanes ? <Swimlane days={lanes} /> : <div className="flex justify-center py-10"><Spinner /></div>}
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        <Card className="p-5">
          <SectionTitle>Steps per day</SectionTitle>
          <DayBars values={days.map((d) => d.steps)} labels={labels} format={(v) => `${fmtNum(v)} steps`} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Sleep per night</SectionTitle>
          <DayBars values={days.map((d) => d.sleepMin)} labels={labels} format={(v) => minutesToHm(v)} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Resting heart rate</SectionTitle>
          <DayBars values={days.map((d) => d.restingHr)} labels={labels} format={(v) => `${fmtNum(v)} bpm`} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Events logged</SectionTitle>
          <DayBars values={days.map((d) => d.eventCount)} labels={labels} format={(v) => `${v} events`} />
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <SectionTitle aside={data && <span className="text-xs text-ink-3">streak {data.streak.current} · best {data.streak.longest}</span>}>Day by day</SectionTitle>
        {loading && !data ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : nDays === 0 ? (
          <Empty icon={CalendarRange} title="No days in range" />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-3">
                  <th className="px-5 py-2 font-semibold">Day</th>
                  <th className="px-3 py-2 font-semibold">Events</th>
                  <th className="px-3 py-2 font-semibold">Steps</th>
                  <th className="px-3 py-2 font-semibold">Sleep</th>
                  <th className="px-3 py-2 font-semibold">RHR</th>
                  <th className="px-3 py-2 font-semibold">HR avg</th>
                  <th className="px-3 py-2 font-semibold">Active</th>
                  <th className="px-3 py-2 font-semibold">Mood</th>
                  <th className="px-3 py-2 font-semibold">Workouts</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-t border-line hover:bg-paper-2">
                    <td className="px-5 py-2.5 font-medium">
                      <Link to={`/?date=${d.date}`} className="hover:underline">
                        {fmtDateShort(d.date)}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {d.eventCount}
                      {d.categories.length > 0 && <span className="ml-2 text-xs text-ink-3">{d.categories.length} types</span>}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(d.steps)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{minutesToHm(d.sleepMin)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(d.restingHr)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(d.hrAvg)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(d.activeKcal)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(d.moodAvg, 1)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{d.workouts || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle>Export this range</SectionTitle>
        <p className="mb-3 text-sm text-ink-2">
          {nDays} day{nDays === 1 ? "" : "s"} of events, health rollups, hourly heart rate and your profile, in one file. The Markdown version is written to be pasted straight into a chat for analysis.
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyMd from={from} to={to} />
          <a className="btn-outline" href={api.exportUrl(from, to, "md")}>
            <Download className="h-4 w-4" /> .md
          </a>
          <a className="btn-outline" href={api.exportUrl(from, to, "json")}>
            <Download className="h-4 w-4" /> .json
          </a>
        </div>
      </Card>
    </div>
  );
}
