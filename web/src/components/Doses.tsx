import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Pill, Undo2 } from "lucide-react";
import type { ReminderDose } from "@sentience/shared";
import { api } from "../lib/api";
import { todayLocal } from "../lib/date";
import { Link } from "react-router-dom";
import { Card, SectionTitle } from "./ui";

/** Today's doses with one-tap "taken". Ticking one off writes a timeline event. */
export function DoseList({ date = todayLocal(), onChange, compact, card }: { date?: string; onChange?: () => void; compact?: boolean; card?: boolean }) {
  const [doses, setDoses] = useState<ReminderDose[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => api.reminders.doses(date).then(setDoses).catch(() => setDoses([])), [date]);
  useEffect(() => {
    void load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  if (!doses || doses.length === 0) return compact ? null : <p className="text-sm text-ink-3">Nothing scheduled for this day.</p>;

  const toggle = async (d: ReminderDose) => {
    const k = `${d.reminderId}|${d.time}`;
    setBusy(k);
    try {
      if (d.status === "taken") await api.reminders.undo(d.reminderId, date, d.time);
      else await api.reminders.taken(d.reminderId, date, d.time);
      await load();
      onChange?.();
      window.dispatchEvent(new Event("sentience:doses"));
    } finally {
      setBusy(null);
    }
  };

  const list = (
    <div className="divide-y divide-line rounded-2xl border border-line">
      {doses.map((d) => {
        const k = `${d.reminderId}|${d.time}`;
        const taken = d.status === "taken";
        return (
          <div key={k} className="flex items-center gap-3 px-3 py-2.5">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${taken ? "bg-accent text-paper" : "bg-paper-3 text-ink-2"}`}>
              {taken ? <Check className="h-4 w-4" /> : d.kind === "supplement" || d.kind === "medication" ? <Pill className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm font-medium ${taken ? "text-ink-3 line-through decoration-line-2" : ""}`}>
                {d.title}
                {d.dose && <span className="ml-1.5 font-normal text-ink-3">{d.dose}</span>}
              </div>
              <div className="text-xs text-ink-3">
                <span className="tabular-nums">{d.time}</span>
                {d.status === "due" && <span className="ml-1.5 font-medium text-warn">due now</span>}
                {d.status === "missed" && <span className="ml-1.5 text-bad">missed</span>}
                {taken && d.takenAt && <span className="ml-1.5">taken {new Date(d.takenAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>
            </div>
            <button className={taken ? "btn-ghost h-9 px-3 text-xs" : "btn-primary h-9 px-3 text-xs"} disabled={busy === k} onClick={() => toggle(d)}>
              {taken ? (
                <>
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> Taken
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
  if (!card) return list;
  const left = doses.filter((d) => d.status !== "taken").length;
  return (
    <Card className="p-5">
      <SectionTitle aside={<Link to="/reminders" className="text-xs text-ink-3 hover:text-ink">{left ? `${left} to go` : "all done"}</Link>}>Reminders</SectionTitle>
      {list}
    </Card>
  );
}
