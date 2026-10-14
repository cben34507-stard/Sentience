import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Fact, FactInput, FactKind, Profile as ProfileT } from "@sentience/shared";
import { FACT_KINDS, FACT_KIND_META } from "@sentience/shared";
import { api } from "../lib/api";
import { apoeType, describe, genotypeFromValue, parse23andMe, type ParsedSnp } from "../lib/snps";
import { Card, Empty, Field, Modal, PageTitle, SectionTitle, Spinner, useToast } from "../components/ui";
import { Select } from "../components/Select";
import { Dna, FolderOpen, Plus, RefreshCw, ShieldCheck } from "lucide-react";

export function Profile() {
  const [profile, setProfile] = useState<ProfileT | null>(null);
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [factForm, setFactForm] = useState<{ open: boolean; editing: Fact | null; kind: FactKind }>({ open: false, editing: null, kind: "condition" });
  const [dna, setDna] = useState<{ open: boolean; found: ParsedSnp[]; total: number; selected: Set<string> } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sex, setSex] = useState<ProfileT["sex"]>("unspecified");
  const [timezone, setTimezone] = useState("UTC");
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const dnaRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [p, f] = await Promise.all([api.profile.get(), api.facts.list()]);
    setProfile(p);
    setSex(p.sex);
    setTimezone(p.timezone);
    setFacts(f);
  }, []);
  useEffect(() => {
    load().catch((e) => toast(e.message, "err"));
  }, [load, toast]);

  const age = useMemo(() => {
    if (!profile?.dateOfBirth) return null;
    return Math.floor((Date.now() - Date.parse(profile.dateOfBirth)) / (365.25 * 86_400_000));
  }, [profile?.dateOfBirth]);
  const bmi = profile?.heightCm && profile?.weightKg ? profile.weightKg / (profile.heightCm / 100) ** 2 : null;

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    try {
      const fd = new FormData(e.currentTarget);
      const num = (k: string) => {
        const v = fd.get(k) as string;
        return v === "" ? null : Number(v);
      };
      setProfile(
        await api.profile.update({
          name: fd.get("name") as string,
          dateOfBirth: (fd.get("dateOfBirth") as string) || null,
          sex,
          heightCm: num("heightCm"),
          weightKg: num("weightKg"),
          timezone,
          bio: fd.get("bio") as string,
        }),
      );
      toast("Profile saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save", "err");
    } finally {
      setSavingProfile(false);
    }
  };

  const grouped = useMemo(() => {
    const g = new Map<FactKind, Fact[]>();
    for (const f of facts ?? []) g.set(f.kind, [...(g.get(f.kind) ?? []), f]);
    return g;
  }, [facts]);

  const onDnaFile = async (file: File) => {
    const text = await file.text();
    const { found, totalLines } = parse23andMe(text);
    if (dnaRef.current) dnaRef.current.value = "";
    if (found.length === 0) {
      toast("No recognised markers — is this the 23andMe raw data .txt?", "err");
      return;
    }
    setDna({ open: true, found, total: totalLines, selected: new Set(found.map((f) => f.rsid)) });
  };

  const importDna = async () => {
    if (!dna) return;
    const existing = new Set((facts ?? []).filter((f) => f.kind === "genetic").map((f) => f.key));
    const items: FactInput[] = dna.found
      .filter((s) => dna.selected.has(s.rsid) && !existing.has(s.rsid))
      .map((s) => ({
        kind: "genetic",
        key: s.rsid,
        value: describe(s.rsid, s.genotype),
        source: "23andMe raw data",
        recordedOn: new Date().toISOString().slice(0, 10),
      }));
    const g = (id: string) => dna.found.find((f) => f.rsid === id)?.genotype ?? null;
    const apoe = apoeType(g("rs429358"), g("rs7412"));
    if (apoe && !existing.has("APOE type")) {
      items.push({ kind: "genetic", key: "APOE type", value: apoe, source: "Derived from rs429358 + rs7412", recordedOn: new Date().toISOString().slice(0, 10) });
    }
    if (items.length === 0) {
      toast("Those markers are already on record");
      setDna(null);
      return;
    }
    await api.facts.bulk(items);
    toast(`Added ${items.length} genetic markers`);
    setDna(null);
    await load();
  };

  /** Re-reads stored genotypes and rewrites their descriptions with the current marker table. */
  const refreshGenetics = async () => {
    if (!facts) return;
    setRefreshing(true);
    try {
      const genetic = facts.filter((f) => f.kind === "genetic");
      let updated = 0;
      const gt = new Map<string, string>();
      for (const f of genetic) {
        const g = genotypeFromValue(f.value);
        if (!g || !/^rs\d+$/.test(f.key)) continue;
        gt.set(f.key, g);
        const next = describe(f.key, g);
        if (next !== f.value) {
          await api.facts.update(f.id, { value: next });
          updated++;
        }
      }
      const apoe = apoeType(gt.get("rs429358") ?? null, gt.get("rs7412") ?? null);
      const existingApoe = genetic.find((f) => f.key === "APOE type");
      if (apoe && !existingApoe) {
        await api.facts.create({ kind: "genetic", key: "APOE type", value: apoe, source: "Derived from rs429358 + rs7412", recordedOn: new Date().toISOString().slice(0, 10) });
        updated++;
      } else if (apoe && existingApoe && existingApoe.value !== apoe) {
        await api.facts.update(existingApoe.id, { value: apoe });
        updated++;
      }
      toast(updated ? `Updated ${updated} genetic readings` : "Genetic readings are up to date");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not refresh", "err");
    } finally {
      setRefreshing(false);
    }
  };

  const tzList = useMemo(() => {
    let list: string[];
    try {
      list = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      list = ["Europe/London", "America/New_York", "America/Los_Angeles"];
    }
    const current = profile?.timezone;
    const set = new Set(["UTC", ...list, ...(current ? [current] : [])]);
    return [...set];
  }, [profile?.timezone]);

  if (!profile) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageTitle title={profile.name ? `Hi, ${profile.name.split(" ")[0]}` : "Profile"} subtitle="Everything an analyst should know about you before reading a single day." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] 2xl:grid-cols-[minmax(0,0.75fr)_minmax(0,2fr)]">
        <Card className="p-5">
          <SectionTitle aside={age != null && <span className="text-xs text-ink-3">{age} yrs{bmi ? ` · BMI ${bmi.toFixed(1)}` : ""}</span>}>Basics</SectionTitle>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Name">
              <input name="name" className="field" defaultValue={profile.name} placeholder="Your name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth">
                <input name="dateOfBirth" type="date" className="field" defaultValue={profile.dateOfBirth ?? ""} />
              </Field>
              <Field label="Sex">
                <Select
                  value={sex}
                  onChange={setSex}
                  options={[
                    { value: "unspecified", label: "Unspecified" },
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "intersex", label: "Intersex" },
                  ]}
                />
              </Field>
              <Field label="Height (cm)">
                <input name="heightCm" type="number" step="0.1" className="field" defaultValue={profile.heightCm ?? ""} />
              </Field>
              <Field label="Weight (kg)">
                <input name="weightKg" type="number" step="0.1" className="field" defaultValue={profile.weightKg ?? ""} />
              </Field>
            </div>
            <Field label="Timezone" hint="Days on the timeline start and end in this zone.">
              <Select value={timezone} onChange={setTimezone} options={tzList.map((z) => ({ value: z, label: z.replace(/_/g, " "), group: z.includes("/") ? z.split("/")[0] : "Other" }))} searchable />
            </Field>
            <Field label="About you" hint="Context for the analyst: job, routine, what you're trying to change.">
              <textarea name="bio" className="field min-h-[110px]" defaultValue={profile.bio} />
            </Field>
            <div className="flex justify-end">
              <button className="btn-primary" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle
              aside={
                <div className="flex gap-1">
                  {grouped.has("genetic") && (
                    <button className="btn-ghost h-8 px-3 text-xs" onClick={refreshGenetics} disabled={refreshing} title="Re-read stored genotypes with the latest marker table">
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh readings
                    </button>
                  )}
                  <button className="btn-outline h-8 px-3 text-xs" onClick={() => dnaRef.current?.click()}>
                    <Dna className="h-3.5 w-3.5" /> Import 23andMe
                  </button>
                  <input ref={dnaRef} type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={(e) => e.target.files?.[0] && void onDnaFile(e.target.files[0])} />
                  <button className="btn-primary h-8 px-3 text-xs" onClick={() => setFactForm({ open: true, editing: null, kind: "condition" })}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              }
            >
              Your record
            </SectionTitle>
            {facts == null ? (
              <Spinner />
            ) : facts.length === 0 ? (
              <Empty
                icon={FolderOpen}
                title="Nothing on record yet"
                body="Conditions, medications, allergies, lab results, genetic markers from a 23andMe raw file — anything that should colour how your days get read."
              />
            ) : (
              <div className="space-y-5 2xl:columns-2 2xl:gap-6 2xl:space-y-0 [&>div]:2xl:mb-5 [&>div]:break-inside-avoid">
                {FACT_KINDS.filter((k) => grouped.has(k)).map((k) => (
                  <div key={k}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{FACT_KIND_META[k].label}</div>
                      <button className="text-xs text-ink-3 hover:text-ink" onClick={() => setFactForm({ open: true, editing: null, kind: k })}>
                        <Plus className="inline h-3 w-3" /> add
                      </button>
                    </div>
                    <ul className="divide-y divide-line rounded-xl border border-line">
                      {grouped.get(k)!.map((f) => (
                        <li key={f.id}>
                          <button className="flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-paper-2" onClick={() => setFactForm({ open: true, editing: f, kind: f.kind })}>
                            <div className="min-w-0">
                              <div className="font-medium">{f.key}</div>
                              <div className="whitespace-pre-wrap text-ink-2">{f.value}</div>
                            </div>
                            <div className="shrink-0 text-right text-[11px] text-ink-3">
                              {f.source && <div>{f.source}</div>}
                              {f.recordedOn && <div>{f.recordedOn}</div>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <FactForm
        open={factForm.open}
        editing={factForm.editing}
        kind={factForm.kind}
        onClose={() => setFactForm((f) => ({ ...f, open: false }))}
        onSaved={async () => {
          await load();
          toast("Saved");
        }}
      />

      <Modal open={!!dna?.open} onClose={() => setDna(null)} title="Import genetic markers" wide>
        {dna && (
          <div>
            <p className="mb-4 text-sm text-ink-2">
              Scanned {dna.total.toLocaleString()} rows locally in your browser and found <b className="text-ink">{dna.found.length}</b> well-studied markers. Only the ones you tick are saved to your server; the raw file never leaves this computer.
            </p>
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {dna.found.map((s) => (
                    <tr key={s.rsid} className="hover:bg-paper-2">
                      <td className="w-8 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={dna.selected.has(s.rsid)}
                          onChange={(e) => {
                            const sel = new Set(dna.selected);
                            if (e.target.checked) sel.add(s.rsid);
                            else sel.delete(s.rsid);
                            setDna({ ...dna, selected: sel });
                          }}
                        />
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{s.rsid}</td>
                      <td className="px-2 py-2 font-mono text-xs font-semibold">{s.genotype}</td>
                      <td className="px-2 py-2 text-xs">
                        <span className="text-ink-2">{describe(s.rsid, s.genotype).split(" — ")[1]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-ink-3">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Readings are population associations, not diagnoses. Genotypes are read as 23andMe reports them (forward strand), which is why some gene names look flipped compared with papers.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDna(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={importDna}>
                Add {dna.selected.size} markers
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FactForm({ open, editing, kind: initialKind, onClose, onSaved }: { open: boolean; editing: Fact | null; kind: FactKind; onClose: () => void; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<FactKind>(initialKind);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [recordedOn, setRecordedOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(editing?.kind ?? initialKind);
    setKey(editing?.key ?? "");
    setValue(editing?.value ?? "");
    setSource(editing?.source ?? "");
    setRecordedOn(editing?.recordedOn ?? "");
    setErr(null);
  }, [open, editing, initialKind]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const input: FactInput = { kind, key, value, source: source || null, recordedOn: recordedOn || null };
      if (editing) await api.facts.update(editing.id, input);
      else await api.facts.create(input);
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit record" : "Add to record"}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Type</span>
          <div className="flex flex-wrap gap-1.5">
            {FACT_KINDS.map((k) => (
              <button type="button" key={k} className={`chip ${kind === k ? "!border-ink !bg-ink !text-paper" : ""}`} onClick={() => setKind(k)}>
                {FACT_KIND_META[k].label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-xs text-ink-3">{FACT_KIND_META[kind].hint}</div>
        </div>
        <Field label="Name">
          <input className="field" value={key} onChange={(e) => setKey(e.target.value)} placeholder={kind === "genetic" ? "rs4680" : kind === "lab" ? "Vitamin D (25-OH)" : "ADHD"} required autoFocus />
        </Field>
        <Field label="Details">
          <textarea className="field min-h-[80px]" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "genetic" ? "AA — slow COMT" : kind === "lab" ? "52 nmol/L (ref 50–125)" : "Diagnosed 2019; methylphenidate 20 mg mornings"} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source">
            <input className="field" value={source} onChange={(e) => setSource(e.target.value)} placeholder="GP letter, 23andMe…" />
          </Field>
          <Field label="Date">
            <input className="field" type="date" value={recordedOn} onChange={(e) => setRecordedOn(e.target.value)} />
          </Field>
        </div>
        {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
        <div className="flex items-center justify-between pt-2">
          {editing ? (
            <button
              type="button"
              className="btn-ghost text-bad hover:text-bad"
              onClick={async () => {
                if (!confirm("Remove this from your record?")) return;
                await api.facts.remove(editing.id);
                await onSaved();
                onClose();
              }}
            >
              Remove
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
