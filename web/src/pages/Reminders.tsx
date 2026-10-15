import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CalendarPlus, ChevronDown, Flame, Pencil, Pill, Plus, Trash2, X } from "lucide-react";
import { REMINDER_KINDS, SUPPLEMENTS, findSupplement, type LabResult, type Reminder, type ReminderInput, type ReminderStatus } from "@sentience/shared";
import { api } from "../lib/api";
import { todayLocal } from "../lib/date";
import { setNotify, useNotifyState } from "../lib/notify";
import { Card, Empty, Field, Modal, PageTitle, Ring, SectionTitle, Spinner, useToast } from "../components/ui";
import { Select, type SelectOption } from "../components/Select";
import { DoseList } from "../components/Doses";
import { EvidenceChip, SupplementGuide } from "../components/SupplementGuide";

const KIND_LABEL: Record<Reminder["kind"], string> = { supplement: "Supplement", medication: "Medication", habit: "Habit", other: "Other" };
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const supplementFor = (r: Pick<Reminder, "supplementKey" | "title">) => (r.supplementKey ? SUPPLEMENTS.find((s) => s.key === r.supplementKey) : undefined) ?? findSupplement(r.title);

function daysText(days: number[]): string {
  if (days.length === 7) return "Every day";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  if (days.join() === "0,6") return "Weekends";
  return days.map((d) => DAY_NAMES[d]).join(", ");
}

export function Reminders() {
  const [list, setList] = useState<ReminderStatus[] | null>(null);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [editing, setEditing] = useState<Reminder | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [browse, setBrowse] = useState(false);
  const [doseKey, setDoseKey] = useState(0);
  const toast = useToast();
  const notify = useNotifyState();

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([api.reminders.list(), api.labs.list().catch(() => [])]);
    setList(r);
    setLabs(l);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const active = list?.filter((r) => r.active) ?? [];
  const paused = list?.filter((r) => !r.active) ?? [];

  return (
    <div>
      <PageTitle
        title="Reminders"
        subtitle="Supplements, medication and anything else you want a nudge for. Tick doses off and they land on your timeline."
        actions={
          <div className="flex flex-wrap gap-2">
            <a className="btn-ghost border border-line" href={api.reminders.calendarUrl} download title="Opens in Calendar on iPhone or Mac and reminds you even with Sentience closed">
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </a>
            <button className="btn-primary" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> New reminder
            </button>
          </div>
        }
      />

      {list == null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="space-y-6">
            <div>
              <SectionTitle>Today</SectionTitle>
              <DoseList key={doseKey} onChange={load} />
            </div>
            <NotifyCard state={notify} />
          </div>

          <div className="space-y-6">
            {active.length === 0 && paused.length === 0 ? (
              <Empty
                icon={Pill}
                title="No reminders yet"
                body="Add the supplements you take (or plan to) and when. Each one shows what it does, how good the evidence is, and what to expect week by week."
                action={
                  <button className="btn-primary" onClick={() => setEditing("new")}>
                    <Plus className="h-4 w-4" /> New reminder
                  </button>
                }
              />
            ) : (
              <div>
                <SectionTitle>Your reminders</SectionTitle>
                <div className="space-y-3">
                  {[...active, ...paused].map((r) => {
                    const s = supplementFor(r);
                    const expanded = open === r.id;
                    return (
                      <Card key={r.id} className={`p-0 ${r.active ? "" : "opacity-60"}`}>
                        <div className="flex items-center gap-4 p-4">
                          <Ring percent={r.adherence ?? 0} size={46}>
                            <span className="text-[11px] font-semibold tabular-nums">{r.adherence != null ? `${Math.round(r.adherence * 100)}%` : "–"}</span>
                          </Ring>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-medium">{r.title}</span>
                              {r.dose && <span className="text-sm text-ink-3">{r.dose}</span>}
                              {!r.active && <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-3">paused</span>}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                              <span>{KIND_LABEL[r.kind]}</span>
                              <span className="tabular-nums">{r.times.join(", ")}</span>
                              <span>{daysText(r.days)}</span>
                              {r.streak > 1 && (
                                <span className="inline-flex items-center gap-1">
                                  <Flame className="h-3 w-3" /> {r.streak}-day streak
                                </span>
                              )}
                            </div>
                          </div>
                          <button className="btn-ghost h-9 w-9 p-0" onClick={() => setEditing(r)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                        {s && (
                          <>
                            <button className="flex w-full items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-left text-sm text-ink-2 hover:bg-paper-2" onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded}>
                              <span className="flex items-center gap-2">
                                What it does and what to expect <EvidenceChip e={s.evidence} />
                              </span>
                              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                            {expanded && (
                              <div className="border-t border-line p-4">
                                <SupplementGuide s={s} daysSinceStart={r.daysSinceStart} adherence={r.adherence} labs={labs} />
                              </div>
                            )}
                          </>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <button className="flex w-full items-center justify-between text-left" onClick={() => setBrowse((b) => !b)} aria-expanded={browse}>
                <SectionTitle>Supplement guide</SectionTitle>
                <ChevronDown className={`mb-3 h-4 w-4 text-ink-3 transition-transform ${browse ? "rotate-180" : ""}`} />
              </button>
              {browse && <Browse labs={labs} onAdd={(key) => setEditing({ ...blank(), title: SUPPLEMENTS.find((s) => s.key === key)!.name, supplementKey: key } as Reminder)} />}
            </div>
          </div>
        </div>
      )}

      <ReminderForm
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={async (msg) => {
          setEditing(null);
          await load();
          setDoseKey((k) => k + 1);
          toast(msg);
        }}
      />
    </div>
  );
}

function NotifyCard({ state }: { state: ReturnType<typeof useNotifyState> }) {
  return (
    <Card className="space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          {state === "on" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-ink-3" />} Notifications
        </div>
        {(state === "on" || state === "off") && (
          <button className={state === "on" ? "btn-ghost border border-line h-9 px-3 text-xs" : "btn-primary h-9 px-3 text-xs"} onClick={() => setNotify(state !== "on")}>
            {state === "on" ? "Turn off" : "Turn on"}
          </button>
        )}
      </div>
      <p className="text-ink-2">
        {state === "on" && "This browser will pop up a reminder when a dose is due, while a Sentience tab is open."}
        {state === "off" && "Get a pop-up in this browser when a dose is due, while a Sentience tab is open."}
        {state === "denied" && "Notifications are blocked for this site in your browser settings."}
        {state === "insecure" && "Browsers only allow notifications over HTTPS. Set up HTTPS (Settings, Security checkup) to turn these on."}
        {state === "unsupported" && "This browser doesn't support notifications."}
      </p>
      <p className="text-xs text-ink-3">
        For reminders with nothing open, use <span className="font-medium text-ink-2">Add to calendar</span>: open the file on your iPhone and Calendar alerts you at each time. It's free and needs no app. Download it again after changing reminders.
      </p>
    </Card>
  );
}

function Browse({ labs, onAdd }: { labs: LabResult[]; onAdd: (key: string) => void }) {
  const [sel, setSel] = useState(SUPPLEMENTS[0].key);
  const s = SUPPLEMENTS.find((x) => x.key === sel)!;
  const opts: SelectOption[] = SUPPLEMENTS.map((x) => ({ value: x.key, label: x.name, group: x.category[0].toUpperCase() + x.category.slice(1) }));
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sel} onChange={setSel} options={opts} searchable aria-label="Supplement" className="min-w-[14rem] flex-1" />
        <button className="btn-ghost border border-line" onClick={() => onAdd(sel)}>
          <Plus className="h-4 w-4" /> Remind me
        </button>
      </div>
      <SupplementGuide s={s} labs={labs} />
    </Card>
  );
}

const blank = (): ReminderInput => ({ title: "", kind: "supplement", supplementKey: null, dose: "", times: ["08:00"], days: [0, 1, 2, 3, 4, 5, 6], notes: "", active: true, startedOn: todayLocal() });

function ReminderForm({ value, onClose, onSaved }: { value: Reminder | "new" | null; onClose: () => void; onSaved: (msg: string) => Promise<void> }) {
  const [f, setF] = useState<ReminderInput>(blank);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const existing = value && value !== "new" && "createdAt" in value ? value : null;
  useEffect(() => {
    if (!value) return;
    setErr(null);
    setF(value === "new" ? blank() : { ...blank(), ...value });
  }, [value]);
  const match = useMemo(() => (f.kind === "supplement" ? findSupplement(f.title) : undefined), [f.title, f.kind]);
  const set = (p: Partial<ReminderInput>) => setF((x) => ({ ...x, ...p }));

  return (
    <Modal open={!!value} onClose={onClose} title={existing ? "Edit reminder" : "New reminder"}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const body = { ...f, title: f.title.trim(), supplementKey: f.kind === "supplement" ? match?.key ?? null : null };
            if (existing) await api.reminders.update(existing.id, body);
            else await api.reminders.create(body);
            await onSaved(existing ? "Reminder updated" : "Reminder added");
          } catch (e2) {
            setErr(e2 instanceof Error ? e2.message : "Couldn't save");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="What">
            <input className="field" list="supplement-names" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Vitamin D3" required autoFocus />
            <datalist id="supplement-names">
              {SUPPLEMENTS.map((s) => (
                <option key={s.key} value={s.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Type">
            <Select value={f.kind} onChange={(k) => set({ kind: k })} options={REMINDER_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} aria-label="Type" />
          </Field>
        </div>
        {f.kind === "supplement" && f.title.trim() && (
          <p className="-mt-2 text-xs text-ink-3">{match ? <>Recognised as {match.name}. You'll get its guide and timeline.</> : "Not in the guide; it'll still remind you."}</p>
        )}
        <Field label="Dose" hint="Optional, e.g. 1000 IU, 5 g, 1 tablet">
          <input className="field" value={f.dose} onChange={(e) => set({ dose: e.target.value })} placeholder={match?.typicalDose.split(/[.;]/)[0] ?? ""} />
        </Field>
        <Field label="Times">
          <div className="flex flex-wrap items-center gap-2">
            {f.times.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="time"
                  className="field w-[7.5rem] tabular-nums"
                  value={t}
                  required
                  onChange={(e) => set({ times: f.times.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                {f.times.length > 1 && (
                  <button type="button" className="btn-ghost h-9 w-8 p-0" onClick={() => set({ times: f.times.filter((_, j) => j !== i) })} aria-label="Remove time">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {f.times.length < 8 && (
              <button type="button" className="btn-ghost text-sm" onClick={() => set({ times: [...f.times, "20:00"] })}>
                <Plus className="h-4 w-4" /> Another time
              </button>
            )}
          </div>
        </Field>
        <Field label="Days">
          <div className="flex gap-1.5">
            {DAYS.map((d, i) => {
              const on = (f.days ?? []).includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[i]}
                  className={`h-9 w-9 rounded-full text-sm font-medium transition-colors ${on ? "bg-accent text-paper" : "border border-line text-ink-3 hover:text-ink"}`}
                  onClick={() => {
                    const next = on ? (f.days ?? []).filter((x) => x !== i) : [...(f.days ?? []), i];
                    if (next.length) set({ days: next.sort() });
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Started" hint="The timeline counts from here">
            <input type="date" className="field" value={f.startedOn} onChange={(e) => set({ startedOn: e.target.value })} required />
          </Field>
          {existing && (
            <Field label="Status">
              <Select value={f.active ? "on" : "off"} onChange={(v) => set({ active: v === "on" })} options={[{ value: "on", label: "Active" }, { value: "off", label: "Paused" }]} aria-label="Status" />
            </Field>
          )}
        </div>
        <Field label="Notes">
          <textarea className="field min-h-[64px]" value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="With breakfast, away from coffee…" />
        </Field>
        {err && <p className="text-sm text-bad">{err}</p>}
        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <button
              type="button"
              className="btn-ghost text-bad"
              onClick={async () => {
                if (!confirm(`Delete "${existing.title}"? Doses you've ticked off stay on your timeline.`)) return;
                await api.reminders.remove(existing.id);
                await onSaved("Reminder deleted");
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary" disabled={busy}>
            {busy ? <Spinner /> : null} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
