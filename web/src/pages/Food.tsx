import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Camera, ChevronLeft, ChevronRight, Droplet, GlassWater, HeartPulse, Pencil, Plus, Settings2, Sparkles, Target, Trash2, Undo2, Utensils, X } from "lucide-react";
import { MEAL_SLOTS, type Event, type MealEstimate, type MealSlot, type NutritionDay } from "@sentience/shared";
import { api } from "../lib/api";
import { addDays, fmtDateLong, fmtNum, fmtTime, fromInputDateTime, todayLocal, toInputDateTime, toLocalIso } from "../lib/date";
import { Card, Field, Modal, PageTitle, Ring, SectionTitle, Spinner, useToast } from "../components/ui";
import { Select } from "../components/Select";

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
const SLOT_HOUR: Record<MealSlot, number> = { breakfast: 8, lunch: 13, dinner: 19, snack: 16 };

function slotOf(e: Event): MealSlot {
  const s = e.data?.slot as MealSlot | undefined;
  if (s && MEAL_SLOTS.includes(s)) return s;
  const tag = e.tags.find((t) => MEAL_SLOTS.includes(t as MealSlot)) as MealSlot | undefined;
  if (tag) return tag;
  const h = new Date(e.startAt).getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 17 ? "snack" : "dinner";
}
const n = (v: unknown) => (typeof v === "number" ? v : 0);

export function Food() {
  const [params, setParams] = useSearchParams();
  const date = params.get("date") ?? todayLocal();
  const setDate = (d: string) => setParams(d === todayLocal() ? {} : { date: d });
  const isToday = date === todayLocal();
  const [day, setDay] = useState<NutritionDay | null>(null);
  const [frequent, setFrequent] = useState<{ title: string; data: Record<string, unknown>; count: number }[]>([]);
  const [adding, setAdding] = useState<{ slot: MealSlot; edit?: Event } | null>(null);
  const [targets, setTargets] = useState(false);
  const [lastWater, setLastWater] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const [d, f] = await Promise.all([api.nutrition(date), api.frequentMeals()]);
    setDay(d);
    setFrequent(f);
  }, [date]);
  useEffect(() => {
    load().catch((e) => toast(e.message, "err"));
  }, [load, toast]);

  const at = (slot: MealSlot) => {
    if (isToday) return toLocalIso(new Date());
    return toLocalIso(new Date(`${date}T${String(SLOT_HOUR[slot]).padStart(2, "0")}:00:00`));
  };

  const addWater = async (ml: number) => {
    const e = await api.events.create({
      category: "drink",
      title: `Water ${ml} ml`,
      startAt: isToday ? toLocalIso(new Date()) : toLocalIso(new Date(`${date}T12:00:00`)),
      data: { water_ml: ml },
      tags: ["water"],
      source: "web",
    });
    setLastWater(e.id);
    toast(`+${ml} ml`);
    await load();
  };

  const bySlot = useMemo(() => {
    const m: Record<MealSlot, Event[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const e of day?.meals ?? []) m[slotOf(e)].push(e);
    return m;
  }, [day]);

  const t = day?.totals;
  const kcalTarget = day?.targets.kcal ?? null;
  const waterTarget = day?.targets.water_ml ?? 2500;
  const glasses = Math.max(8, Math.ceil(waterTarget / 250));
  const filled = Math.floor((t?.water_ml ?? 0) / 250);

  return (
    <div>
      <PageTitle
        title="Food & water"
        subtitle={fmtDateLong(date)}
        actions={
          <>
            <button className="btn-outline h-10 w-10 p-0" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn-outline h-10 w-10 p-0" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button className="btn-ghost h-10" onClick={() => setTargets(true)}>
              <Target className="h-4 w-4" /> Targets
            </button>
            <button className="btn-primary h-10" onClick={() => setAdding({ slot: currentSlot() })}>
              <Plus className="h-4 w-4" /> Add food
            </button>
          </>
        }
      />

      {!day ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="space-y-6">
            <Card className="p-5">
              <SectionTitle>Calories</SectionTitle>
              <div className="flex items-center gap-6">
                <Ring percent={kcalTarget ? (t?.kcal ?? 0) / kcalTarget : 0} size={120} stroke={9}>
                  <div className="text-center">
                    <div className="text-2xl font-semibold tabular-nums">{fmtNum(t?.kcal)}</div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-ink-3">kcal</div>
                  </div>
                </Ring>
                <div className="min-w-0 flex-1 space-y-3">
                  {kcalTarget ? (
                    <div className="text-sm text-ink-2">
                      {t!.kcal <= kcalTarget ? (
                        <>
                          <b className="text-ink">{fmtNum(kcalTarget - t!.kcal)}</b> left of {fmtNum(kcalTarget)}
                        </>
                      ) : (
                        <>
                          <b className="text-warn">{fmtNum(t!.kcal - kcalTarget)}</b> over {fmtNum(kcalTarget)}
                        </>
                      )}
                    </div>
                  ) : (
                    <button className="text-sm text-ink-3 underline-offset-2 hover:text-ink hover:underline" onClick={() => setTargets(true)}>
                      Set a daily target
                    </button>
                  )}
                  <Macro label="Protein" value={t?.protein_g ?? 0} target={day.targets.protein_g} color="var(--series-1)" />
                  <Macro label="Carbs" value={t?.carbs_g ?? 0} color="var(--series-4)" />
                  <Macro label="Fat" value={t?.fat_g ?? 0} color="var(--series-2)" />
                </div>
              </div>
              {(day.appleHealth.kcal ?? 0) > 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-paper-2 px-3 py-2 text-xs text-ink-2">
                  <HeartPulse className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Apple Health also has {fmtNum(day.appleHealth.kcal)} kcal for this day (e.g. from MyFitnessPal). It's shown here, not added to your total.
                </div>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle aside={lastWater && <button className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink" onClick={async () => { await api.events.remove(lastWater); setLastWater(null); await load(); }}><Undo2 className="h-3.5 w-3.5" /> Undo</button>}>Water</SectionTitle>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-3xl font-semibold tabular-nums">{((t?.water_ml ?? 0) / 1000).toFixed(2)}</span>
                  <span className="ml-1 text-sm text-ink-3">/ {(waterTarget / 1000).toFixed(1)} L</span>
                </div>
                {(day.appleHealth.water_ml ?? 0) > 0 && <span className="text-xs text-ink-3">Apple Health: {((day.appleHealth.water_ml ?? 0) / 1000).toFixed(2)} L</span>}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {Array.from({ length: glasses }, (_, i) => (
                  <motion.div key={i} initial={false} animate={{ scale: i < filled ? 1 : 0.92 }} className={`grid h-10 w-8 place-items-center rounded-lg border ${i < filled ? "border-transparent text-white" : "border-line text-ink-3"}`} style={i < filled ? { background: "var(--series-1)" } : undefined}>
                    <GlassWater className="h-4 w-4" />
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { ml: 250, label: "Glass" },
                  { ml: 330, label: "Can" },
                  { ml: 500, label: "Bottle" },
                  { ml: 750, label: "Large bottle" },
                ].map((w) => (
                  <button key={w.ml} className="chip" onClick={() => void addWater(w.ml)}>
                    <Droplet className="h-3.5 w-3.5" /> {w.label} · {w.ml} ml
                  </button>
                ))}
              </div>
            </Card>

            {frequent.length > 0 && (
              <Card className="p-5">
                <SectionTitle>Quick add</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {frequent.map((f) => (
                    <button
                      key={f.title}
                      className="chip"
                      onClick={async () => {
                        const slot = (f.data.slot as MealSlot) ?? currentSlot();
                        await api.events.create({ category: "meal", title: f.title, startAt: at(slot), data: { ...f.data, slot }, tags: [slot], source: "web" });
                        toast(`Added ${f.title}`);
                        await load();
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> {f.title} <span className="text-ink-3">· {fmtNum(n(f.data.kcal))}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {MEAL_SLOTS.map((slot) => {
              const items = bySlot[slot];
              const kcal = items.reduce((a, e) => a + n(e.data?.kcal), 0);
              return (
                <Card key={slot} className="p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-baseline gap-3">
                      <h3 className="font-semibold">{SLOT_LABEL[slot]}</h3>
                      <span className="text-sm tabular-nums text-ink-3">{fmtNum(kcal)} kcal</span>
                    </div>
                    <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setAdding({ slot })}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  {items.length === 0 ? (
                    <div className="py-2 text-sm text-ink-3">Nothing logged.</div>
                  ) : (
                    <ul className="divide-y divide-line">
                      <AnimatePresence initial={false}>
                        {items.map((e) => (
                          <motion.li key={e.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">{e.title}</span>
                                {e.data?.estimated === true && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-semibold text-ink-2">
                                    <Sparkles className="h-3 w-3" /> AI estimate
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-xs text-ink-3">
                                {fmtTime(e.startAt)}
                                {typeof e.data?.portion === "string" && e.data.portion ? ` · ${e.data.portion}` : ""} · P {fmtNum(n(e.data?.protein_g))}g · C {fmtNum(n(e.data?.carbs_g))}g · F {fmtNum(n(e.data?.fat_g))}g
                              </div>
                            </div>
                            <div className="shrink-0 text-sm font-semibold tabular-nums">{fmtNum(n(e.data?.kcal))}</div>
                            <button className="btn-ghost h-8 w-8 p-0" onClick={() => setAdding({ slot, edit: e })} aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <AddFood
        open={!!adding}
        slot={adding?.slot ?? "lunch"}
        edit={adding?.edit}
        defaultAt={adding ? at(adding.slot) : ""}
        onClose={() => setAdding(null)}
        onSaved={async (msg) => {
          await load();
          toast(msg);
        }}
      />
      <TargetsForm open={targets} onClose={() => setTargets(false)} onSaved={load} />
    </div>
  );
}

function currentSlot(): MealSlot {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 17 ? "snack" : "dinner";
}

function Macro({ label, value, target, color }: { label: string; value: number; target?: number | null; color: string }) {
  const pct = target ? Math.min(1, value / target) : Math.min(1, value / 150);
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tabular-nums text-ink-3">
          {fmtNum(value)} g{target ? ` / ${target} g` : ""}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-3">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.6 }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface Row {
  name: string;
  portion: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fibre_g: string;
}
const blank = (): Row => ({ name: "", portion: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "", fibre_g: "" });
const num = (s: string) => {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) && s.trim() !== "" ? Math.round(v * 10) / 10 : 0;
};

/** Shrinks a photo to ≤1568px JPEG before upload: plenty for recognising food, far smaller to send. */
async function shrink(file: File): Promise<{ data: string; mediaType: "image/jpeg"; preview: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], mediaType: "image/jpeg", preview: url };
}

function AddFood({ open, slot: initialSlot, edit, defaultAt, onClose, onSaved }: { open: boolean; slot: MealSlot; edit?: Event; defaultAt: string; onClose: () => void; onSaved: (msg: string) => Promise<void> }) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [when, setWhen] = useState("");
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<{ data: string; mediaType: "image/jpeg"; preview: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSlot(initialSlot);
    setErr(null);
    setEstimate(null);
    setPhoto(null);
    setDesc("");
    api.ai.status().then((s) => setAiOn(s.enabled)).catch(() => setAiOn(false));
    if (edit) {
      setMode("manual");
      setWhen(toInputDateTime(edit.startAt));
      const d = edit.data ?? {};
      setRows([{ name: edit.title, portion: String(d.portion ?? ""), kcal: String(d.kcal ?? ""), protein_g: String(d.protein_g ?? ""), carbs_g: String(d.carbs_g ?? ""), fat_g: String(d.fat_g ?? ""), fibre_g: String(d.fibre_g ?? "") }]);
    } else {
      setWhen(defaultAt ? toInputDateTime(defaultAt) : toInputDateTime(new Date().toISOString()));
      setRows([blank()]);
    }
  }, [open, edit, initialSlot, defaultAt]);

  useEffect(() => {
    if (open && !edit && aiOn === false) setMode("manual");
  }, [aiOn, open, edit]);

  const runEstimate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const est = await api.ai.estimateMeal(desc, photo ? { data: photo.data, mediaType: photo.mediaType } : undefined);
      setEstimate(est);
      setRows(est.items.map((i) => ({ name: i.name, portion: i.portion, kcal: String(Math.round(i.kcal)), protein_g: String(Math.round(i.protein_g)), carbs_g: String(Math.round(i.carbs_g)), fat_g: String(Math.round(i.fat_g)), fibre_g: String(Math.round(i.fibre_g)) })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Estimate failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async (combine: boolean) => {
    const valid = rows.filter((r) => r.name.trim() && r.kcal.trim());
    if (!valid.length) {
      setErr("Add at least one food with calories.");
      return;
    }
    const startAt = fromInputDateTime(when);
    const estimated = !!estimate;
    const toData = (r: Row) => ({ slot, portion: r.portion || undefined, kcal: num(r.kcal), protein_g: num(r.protein_g), carbs_g: num(r.carbs_g), fat_g: num(r.fat_g), fibre_g: num(r.fibre_g), estimated: estimated || (edit?.data?.estimated === true) || undefined });
    setBusy(true);
    try {
      if (edit) {
        await api.events.update(edit.id, { title: valid[0].name, startAt, data: { ...edit.data, ...toData(valid[0]) }, tags: [slot] });
        await onSaved("Updated");
      } else if (combine && valid.length > 1) {
        const sum = (k: keyof Row) => valid.reduce((a, r) => a + num(r[k]), 0);
        const title = desc.trim() ? desc.trim().slice(0, 120) : valid.map((r) => r.name).join(", ");
        await api.events.create({
          category: "meal",
          title,
          startAt,
          tags: [slot],
          notes: valid.map((r) => `${r.name} (${r.portion}): ${r.kcal} kcal`).join("\n") + (estimate?.notes ? `\n${estimate.notes}` : ""),
          data: { slot, portion: valid.map((r) => r.portion).filter(Boolean).join(" + ") || undefined, kcal: sum("kcal"), protein_g: sum("protein_g"), carbs_g: sum("carbs_g"), fat_g: sum("fat_g"), fibre_g: sum("fibre_g"), estimated: estimated || undefined, items: valid.map((r) => ({ name: r.name, portion: r.portion, kcal: num(r.kcal) })) },
          source: "web",
        });
        await onSaved(`Logged ${Math.round(sum("kcal"))} kcal`);
      } else {
        for (const r of valid) await api.events.create({ category: "meal", title: r.name, startAt, tags: [slot], data: toData(r), source: "web" });
        await onSaved(`Logged ${valid.length} item${valid.length === 1 ? "" : "s"}`);
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const total = rows.reduce((a, r) => a + num(r.kcal), 0);
  const upd = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit food" : "Add food"} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Meal">
            <Select value={slot} onChange={setSlot} options={MEAL_SLOTS.map((s) => ({ value: s, label: SLOT_LABEL[s] }))} />
          </Field>
          <Field label="When">
            <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          {!edit && (
            <div className="flex items-end">
              <div className="inline-flex rounded-full border border-line bg-paper-2 p-1">
                {(["ai", "manual"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${mode === m ? "bg-paper text-ink shadow-soft" : "text-ink-3"}`}>
                    {m === "ai" ? "Describe it" : "Enter numbers"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {mode === "ai" && !edit && (
          <div className="space-y-3 rounded-2xl border border-line p-4">
            {aiOn === false ? (
              <div className="flex items-start gap-3 text-sm text-ink-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  AI estimates are off. Add an Anthropic API key in{" "}
                  <Link to="/settings" className="font-medium text-ink underline underline-offset-2" onClick={onClose}>
                    Settings
                  </Link>{" "}
                  to turn them on, or enter the numbers yourself.
                </div>
              </div>
            ) : (
              <>
                <Field label="What did you eat?" hint='Be as rough as you like: "about two portions of homemade lasagne with garlic bread".'>
                  <textarea className="field min-h-[72px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Two big portions of homemade lasagne and three slices of garlic bread" />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
                    <Camera className="h-4 w-4" /> {photo ? "Change photo" : "Add a photo"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setPhoto(await shrink(f));
                      e.target.value = "";
                    }}
                  />
                  {photo && (
                    <div className="relative">
                      <img src={photo.preview} alt="Meal" className="h-12 w-12 rounded-lg object-cover" />
                      <button type="button" className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-paper" onClick={() => setPhoto(null)} aria-label="Remove photo">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <button type="button" className="btn-primary ml-auto" disabled={busy || (!desc.trim() && !photo)} onClick={runEstimate}>
                    {busy ? <Spinner className="border-paper/40 border-t-paper" /> : <Sparkles className="h-4 w-4" />} Estimate
                  </button>
                </div>
                {estimate && (
                  <div className="rounded-xl bg-paper-2 px-3 py-2 text-xs text-ink-2">
                    <b className="text-ink">Confidence: {estimate.confidence}.</b> {estimate.notes} Adjust anything below before saving.
                  </div>
                )}
                <p className="text-[11px] text-ink-3">Your description and photo are sent to Anthropic's API for this estimate only.</p>
              </>
            )}
          </div>
        )}

        {(mode === "manual" || estimate || edit) && (
          <div>
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_repeat(4,minmax(0,0.7fr))_32px] gap-2 px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3 md:grid">
              <span>Food</span>
              <span>Portion</span>
              <span>kcal</span>
              <span>Protein g</span>
              <span>Carbs g</span>
              <span>Fat g</span>
              <span />
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_repeat(4,minmax(0,0.7fr))_32px] md:border-0 md:p-0">
                  <input className="field col-span-2 md:col-span-1" placeholder="Food" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
                  <input className="field col-span-2 md:col-span-1" placeholder="e.g. 350 g" value={r.portion} onChange={(e) => upd(i, { portion: e.target.value })} />
                  <input className="field tabular-nums" inputMode="decimal" placeholder="kcal" value={r.kcal} onChange={(e) => upd(i, { kcal: e.target.value })} />
                  <input className="field tabular-nums" inputMode="decimal" placeholder="P" value={r.protein_g} onChange={(e) => upd(i, { protein_g: e.target.value })} />
                  <input className="field tabular-nums" inputMode="decimal" placeholder="C" value={r.carbs_g} onChange={(e) => upd(i, { carbs_g: e.target.value })} />
                  <input className="field tabular-nums" inputMode="decimal" placeholder="F" value={r.fat_g} onChange={(e) => upd(i, { fat_g: e.target.value })} />
                  {!edit && (
                    <button type="button" className="btn-ghost h-10 w-8 p-0" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))} aria-label="Remove">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!edit && (
              <button type="button" className="btn-ghost mt-1 text-sm" onClick={() => setRows((rs) => [...rs, blank()])}>
                <Plus className="h-4 w-4" /> Add another item
              </button>
            )}
            <div className="mt-2 text-right text-sm text-ink-2">
              Total <b className="tabular-nums text-ink">{fmtNum(total)}</b> kcal
            </div>
          </div>
        )}

        {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {edit ? (
            <button
              type="button"
              className="btn-ghost text-bad hover:text-bad"
              onClick={async () => {
                await api.events.remove(edit.id);
                await onSaved("Removed");
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            {!edit && rows.filter((r) => r.name && r.kcal).length > 1 && (
              <button type="button" className="btn-outline" disabled={busy} onClick={() => void save(false)}>
                Save items separately
              </button>
            )}
            {(mode === "manual" || estimate || edit) && (
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void save(true)}>
                <Utensils className="h-4 w-4" /> {edit ? "Save" : "Log meal"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TargetsForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [water, setWater] = useState("");
  useEffect(() => {
    if (!open) return;
    api.profile.get().then((p) => {
      setKcal(p.calorieTarget?.toString() ?? "");
      setProtein(p.proteinTargetG?.toString() ?? "");
      setWater(p.waterTargetMl?.toString() ?? "2500");
    });
  }, [open]);
  const int = (s: string) => (s.trim() ? Math.round(Number(s)) || null : null);
  return (
    <Modal open={open} onClose={onClose} title="Daily targets">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await api.profile.update({ calorieTarget: int(kcal), proteinTargetG: int(protein), waterTargetMl: int(water) });
          await onSaved();
          onClose();
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Calories (kcal)">
            <input className="field" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="2200" />
          </Field>
          <Field label="Protein (g)">
            <input className="field" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="140" />
          </Field>
          <Field label="Water (ml)">
            <input className="field" inputMode="numeric" value={water} onChange={(e) => setWater(e.target.value)} placeholder="2500" />
          </Field>
        </div>
        <p className="flex items-start gap-2 text-xs text-ink-3">
          <Settings2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Targets also work as goals: create a goal measured by "Water (ml)" or "Calories" on the Goals page to track streaks.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

