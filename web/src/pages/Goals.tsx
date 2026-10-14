import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { Achievement, GoalInput, GoalStatus } from "@sentience/shared";
import { EVENT_CATEGORIES, EVENT_CATEGORY_META, GOAL_CADENCES, HEALTH_TYPE_META } from "@sentience/shared";
import { api } from "../lib/api";
import { fmtNum, todayLocal } from "../lib/date";
import { Card, Empty, Field, Modal, PageTitle, Ring, SectionTitle, Spinner, useToast } from "../components/ui";
import { Select, type SelectOption } from "../components/Select";
import { achievementIcon, CategoryIcon } from "../components/icons";
import { Check, Flame, HeartPulse, PencilLine, Plus, Target } from "lucide-react";

export function Goals() {
  const [goals, setGoals] = useState<GoalStatus[] | null>(null);
  const [ach, setAch] = useState<Achievement[] | null>(null);
  const [form, setForm] = useState<{ open: boolean; editing: GoalStatus | null }>({ open: false, editing: null });
  const [progressFor, setProgressFor] = useState<GoalStatus | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const [g, a] = await Promise.all([api.goals.list(), api.achievements()]);
    setGoals(g);
    setAch(a);
  }, []);
  useEffect(() => {
    load().catch((e) => toast(e.message, "err"));
  }, [load, toast]);

  const unlocked = ach?.filter((a) => a.unlockedAt).length ?? 0;

  return (
    <div>
      <PageTitle
        title="Goals"
        subtitle="Targets that measure themselves from your timeline and health data, plus a few you tick off by hand."
        actions={
          <button className="btn-primary" onClick={() => setForm({ open: true, editing: null })}>
            <Plus className="h-4 w-4" /> New goal
          </button>
        }
      />

      {goals == null ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : goals.length === 0 ? (
        <Empty
          icon={Target}
          title="No goals yet"
          body="Try “8,000 steps daily” measured from Apple Health, or “3 workouts weekly” counted from your timeline."
          action={
            <button className="btn-primary" onClick={() => setForm({ open: true, editing: null })}>
              Create one
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {goals.map((g) => (
            <motion.div key={g.goal.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start gap-4">
                  <Ring percent={g.percent} size={56} stroke={5}>
                    {g.complete ? <Check className="h-5 w-5" strokeWidth={2.5} /> : `${Math.round(g.percent * 100)}%`}
                  </Ring>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{g.goal.title}</div>
                    <div className="text-xs text-ink-3">
                      {g.goal.cadence} · {metricLabel(g.goal.metric)}
                    </div>
                    <div className="mt-1 text-sm tabular-nums">
                      <span className="font-semibold">{fmtNum(g.current, 1)}</span>
                      <span className="text-ink-3">
                        {" "}
                        / {fmtNum(g.target, 1)} {g.goal.unit}
                      </span>
                    </div>
                  </div>
                </div>
                {g.goal.description && <p className="mt-3 text-sm text-ink-2">{g.goal.description}</p>}
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                    {g.streak > 0 ? (
                      <>
                        <Flame className="h-3.5 w-3.5" /> {g.streak} {g.goal.cadence === "once" ? "" : "in a row"}
                      </>
                    ) : (
                      "no streak yet"
                    )}
                  </span>
                  <div className="flex gap-1">
                    {g.goal.metric === "manual" && (
                      <button className="btn-outline h-8 px-3 text-xs" onClick={() => setProgressFor(g)}>
                        <Plus className="h-3.5 w-3.5" /> Progress
                      </button>
                    )}
                    <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setForm({ open: true, editing: g })}>
                      Edit
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <SectionTitle aside={ach && <span className="text-xs text-ink-3">{unlocked} / {ach.length} unlocked</span>}>Achievements</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {(ach ?? []).map((a, i) => {
            const AIcon = achievementIcon(a.icon);
            return (
            <motion.div key={a.code} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className={`p-4 ${a.unlockedAt ? "" : "opacity-70"}`}>
                <div className="flex items-center gap-3">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${a.unlockedAt ? "bg-ink text-paper" : "bg-paper-3 text-ink-3"}`}>
                    <AIcon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{a.title}</div>
                    <div className="truncate text-xs text-ink-3">{a.description}</div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-3">
                  <motion.div className={`h-full rounded-full ${a.unlockedAt ? "bg-good" : "bg-ink-3"}`} initial={{ width: 0 }} animate={{ width: `${a.progress * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                </div>
                <div className="mt-1 text-[11px] text-ink-3">{a.unlockedAt ? `Unlocked ${new Date(a.unlockedAt).toLocaleDateString()}` : `${Math.round(a.progress * 100)}%`}</div>
              </Card>
            </motion.div>
            );
          })}
        </div>
      </div>

      <GoalForm
        open={form.open}
        editing={form.editing}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={async () => {
          await load();
          toast("Saved");
        }}
      />
      <ProgressForm
        goal={progressFor}
        onClose={() => setProgressFor(null)}
        onSaved={async () => {
          await load();
          toast("Progress logged");
        }}
      />
    </div>
  );
}

const METRIC_OPTIONS: SelectOption[] = [
  { value: "manual", label: "Manual", hint: "I log progress myself", icon: <PencilLine className="h-4 w-4" /> },
  ...EVENT_CATEGORIES.map((c) => ({
    value: `events:${c}`,
    label: `${EVENT_CATEGORY_META[c].label} events`,
    hint: "Counted from your timeline",
    group: "Timeline",
    icon: <CategoryIcon category={c} />,
  })),
  { value: "data:water_ml", label: "Water drunk", hint: "ml, from the Food page", group: "Food & water", icon: <PencilLine className="h-4 w-4" /> },
  { value: "data:kcal", label: "Calories eaten", hint: "kcal, from the Food page", group: "Food & water", icon: <PencilLine className="h-4 w-4" /> },
  { value: "data:protein_g", label: "Protein eaten", hint: "g, from the Food page", group: "Food & water", icon: <PencilLine className="h-4 w-4" /> },
  ...Object.entries(HEALTH_TYPE_META).map(([k, m]) => ({
    value: `health:${k}`,
    label: m.label,
    hint: m.unit,
    group: "Apple Health",
    icon: <HeartPulse className="h-4 w-4" />,
  })),
];

function metricLabel(metric: string): string {
  if (metric === "manual") return "logged by hand";
  if (metric.startsWith("events:")) {
    const c = metric.slice(7) as keyof typeof EVENT_CATEGORY_META;
    return `${EVENT_CATEGORY_META[c]?.label ?? c} events`;
  }
  if (metric.startsWith("health:")) return HEALTH_TYPE_META[metric.slice(7)]?.label ?? metric.slice(7);
  if (metric === "data:water_ml") return "water drunk";
  if (metric === "data:kcal") return "calories eaten";
  if (metric === "data:protein_g") return "protein eaten";
  return metric;
}

function GoalForm({ open, editing, onClose, onSaved }: { open: boolean; editing: GoalStatus | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<GoalInput["cadence"]>("daily");
  const [target, setTarget] = useState("1");
  const [unit, setUnit] = useState("");
  const [metric, setMetric] = useState("manual");
  const [startsOn, setStartsOn] = useState(todayLocal());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const g = editing?.goal;
    setTitle(g?.title ?? "");
    setDescription(g?.description ?? "");
    setCadence(g?.cadence ?? "daily");
    setTarget(String(g?.target ?? 1));
    setUnit(g?.unit ?? "");
    setMetric(g?.metric ?? "manual");
    setStartsOn(g?.startsOn ?? todayLocal());
    setErr(null);
  }, [open, editing]);

  const pickMetric = (m: string) => {
    setMetric(m);
    if (m.startsWith("health:")) setUnit(HEALTH_TYPE_META[m.slice(7)]?.unit ?? "");
    else if (m.startsWith("events:")) setUnit("times");
    else if (m === "data:water_ml") setUnit("ml");
    else if (m === "data:kcal") setUnit("kcal");
    else if (m === "data:protein_g") setUnit("g");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const input: GoalInput = { title, description, cadence, target: Number(target), unit, metric, startsOn, color: "blue", archived: false };
      if (editing) await api.goals.update(editing.goal.id, input);
      else await api.goals.create(input);
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit goal" : "New goal"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="8,000 steps" required autoFocus />
        </Field>
        <Field label="Measured by">
          <Select value={metric} onChange={pickMetric} options={METRIC_OPTIONS} searchable />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target">
            <input className="field" type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} required />
          </Field>
          <Field label="Unit">
            <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="steps" />
          </Field>
          <Field label="Cadence">
            <Select value={cadence} onChange={(v) => setCadence(v)} options={GOAL_CADENCES.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))} />
          </Field>
        </div>
        <Field label="Starts on">
          <input className="field" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </Field>
        <Field label="Why">
          <textarea className="field min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional — what this is in service of" />
        </Field>
        {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
        <div className="flex items-center justify-between pt-2">
          {editing ? (
            <button
              type="button"
              className="btn-ghost text-bad hover:text-bad"
              onClick={async () => {
                if (!confirm("Delete this goal?")) return;
                await api.goals.remove(editing.goal.id);
                await onSaved();
                onClose();
              }}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ProgressForm({ goal, onClose, onSaved }: { goal: GoalStatus | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [amount, setAmount] = useState("1");
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAmount("1");
    setDate(todayLocal());
    setNote("");
  }, [goal]);
  return (
    <Modal open={!!goal} onClose={onClose} title={goal ? `Progress: ${goal.goal.title}` : ""}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!goal) return;
          setBusy(true);
          try {
            await api.goals.progress(goal.goal.id, Number(amount), date, note || undefined);
            await onSaved();
            onClose();
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Amount${goal?.goal.unit ? ` (${goal.goal.unit})` : ""}`}>
            <input className="field" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          <Field label="Date">
            <input className="field" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            Log
          </button>
        </div>
      </form>
    </Modal>
  );
}
