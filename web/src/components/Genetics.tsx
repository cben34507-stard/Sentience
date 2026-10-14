import { useMemo, useRef, useState } from "react";
import { Dna, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { Fact, FactInput } from "@sentience/shared";
import { api } from "../lib/api";
import { apoeType, describe, EVIDENCE_ORDER, genotypeFromValue, parse23andMe, snpParts, type Evidence, type ParsedSnp } from "../lib/snps";
import { Card, Empty, Modal, SectionTitle, useToast } from "./ui";

const EVIDENCE_LABEL: Record<Evidence, { title: string; hint: string }> = {
  strong: { title: "Strong evidence", hint: "Large, well-replicated studies" },
  moderate: { title: "Moderate evidence", hint: "Replicated, smaller or less consistent effects" },
  weak: { title: "Weak evidence", hint: "Mixed or early findings; read lightly" },
};

/**
 * Genetic markers, ordered by how much the science backs them: strong first,
 * then moderate, then weak. Imports and refreshes happen here too.
 */
export function Genetics({ facts, onChanged }: { facts: Fact[]; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [dna, setDna] = useState<{ found: ParsedSnp[]; total: number; selected: Set<string> } | null>(null);

  const genetic = useMemo(() => facts.filter((f) => f.kind === "genetic"), [facts]);
  const apoe = genetic.find((f) => f.key === "APOE type");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return genetic
      .filter((f) => /^rs\d+$/.test(f.key))
      .map((f) => {
        const g = genotypeFromValue(f.value) ?? "";
        return { f, g, ...snpParts(f.key, g) };
      })
      .filter((r) => !needle || `${r.f.key} ${r.gene} ${r.about} ${r.call ?? ""}`.toLowerCase().includes(needle));
  }, [genetic, q]);

  const byEvidence = EVIDENCE_ORDER.map((e) => ({ e, items: rows.filter((r) => r.evidence === e).sort((a, b) => a.gene.localeCompare(b.gene)) }));

  const onFile = async (f: File) => {
    const { found, totalLines } = parse23andMe(await f.text());
    if (file.current) file.current.value = "";
    if (found.length === 0) {
      toast("No recognised markers. Is this the 23andMe raw data .txt?", "err");
      return;
    }
    setDna({ found, total: totalLines, selected: new Set(found.map((s) => s.rsid)) });
  };

  const importDna = async () => {
    if (!dna) return;
    const existing = new Set(genetic.map((f) => f.key));
    const today = new Date().toISOString().slice(0, 10);
    const items: FactInput[] = dna.found
      .filter((s) => dna.selected.has(s.rsid) && !existing.has(s.rsid))
      .map((s) => ({ kind: "genetic", key: s.rsid, value: describe(s.rsid, s.genotype), source: "23andMe raw data", recordedOn: today }));
    const g = (id: string) => dna.found.find((f) => f.rsid === id)?.genotype ?? null;
    const a = apoeType(g("rs429358"), g("rs7412"));
    if (a && !existing.has("APOE type")) items.push({ kind: "genetic", key: "APOE type", value: a, source: "Derived from rs429358 + rs7412", recordedOn: today });
    if (items.length) await api.facts.bulk(items);
    toast(items.length ? `Added ${items.length} genetic markers` : "Those markers are already on record");
    setDna(null);
    await onChanged();
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
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
      const a = apoeType(gt.get("rs429358") ?? null, gt.get("rs7412") ?? null);
      if (a && !apoe) {
        await api.facts.create({ kind: "genetic", key: "APOE type", value: a, source: "Derived from rs429358 + rs7412", recordedOn: new Date().toISOString().slice(0, 10) });
        updated++;
      } else if (a && apoe && apoe.value !== a) {
        await api.facts.update(apoe.id, { value: a });
        updated++;
      }
      toast(updated ? `Updated ${updated} readings` : "Readings are up to date");
      await onChanged();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input className="field pl-9" placeholder="Search gene, rsID or trait" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {genetic.length > 0 && (
            <button className="btn-ghost" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh readings
            </button>
          )}
          <button className="btn-primary" onClick={() => file.current?.click()}>
            <Dna className="h-4 w-4" /> Import 23andMe
          </button>
          <input ref={file} type="file" accept=".txt,.csv,.tsv" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
        </div>
      </div>

      {genetic.length === 0 ? (
        <Empty icon={Dna} title="No genetic markers yet" body="Import your 23andMe raw data file. It's read in your browser; only the markers you tick are saved." />
      ) : (
        <div className="space-y-8">
          {apoe && (
            <Card className="flex items-start gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-paper">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">APOE type</div>
                <div className="mt-0.5 text-lg font-semibold">{apoe.value.split(" — ")[0]}</div>
                <div className="text-sm text-ink-2">{apoe.value.split(" — ")[1]}</div>
              </div>
            </Card>
          )}
          {byEvidence.map(({ e, items }) =>
            items.length === 0 ? null : (
              <section key={e}>
                <SectionTitle aside={<span className="text-xs text-ink-3">{EVIDENCE_LABEL[e].hint}</span>}>
                  {EVIDENCE_LABEL[e].title} · {items.length}
                </SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {items.map((r) => (
                    <Card key={r.f.id} className={`p-4 ${e === "weak" ? "opacity-85" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{r.known ? r.gene : r.f.key}</div>
                          <div className="truncate text-xs text-ink-3">
                            {r.f.key} · {r.about}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-lg bg-paper-3 px-2 py-1 font-mono text-sm font-semibold tracking-wider">{r.g || "?"}</span>
                      </div>
                      <p className="mt-2 text-sm text-ink-2">{r.call ?? (r.known ? "No specific reading for this genotype." : r.f.value)}</p>
                    </Card>
                  ))}
                </div>
              </section>
            ),
          )}
          <p className="flex items-start gap-2 text-xs text-ink-3">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Population associations, not diagnoses. Genotypes are read as 23andMe reports them (forward strand, build 37).
          </p>
        </div>
      )}

      <Modal open={!!dna} onClose={() => setDna(null)} title="Import genetic markers" wide>
        {dna && (
          <div>
            <p className="mb-4 text-sm text-ink-2">
              Scanned {dna.total.toLocaleString()} rows in your browser and found <b className="text-ink">{dna.found.length}</b> well-studied markers. Only the ones you tick are saved to your server; the raw file never leaves this device.
            </p>
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {[...dna.found]
                    .sort((a, b) => EVIDENCE_ORDER.indexOf(snpParts(a.rsid, a.genotype).evidence) - EVIDENCE_ORDER.indexOf(snpParts(b.rsid, b.genotype).evidence))
                    .map((s) => {
                      const parts = snpParts(s.rsid, s.genotype);
                      return (
                        <tr key={s.rsid} className="hover:bg-paper-2">
                          <td className="w-8 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={dna.selected.has(s.rsid)}
                              onChange={(ev) => {
                                const sel = new Set(dna.selected);
                                if (ev.target.checked) sel.add(s.rsid);
                                else sel.delete(s.rsid);
                                setDna({ ...dna, selected: sel });
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 font-mono text-xs">{s.rsid}</td>
                          <td className="px-2 py-2 font-mono text-xs font-semibold">{s.genotype}</td>
                          <td className="px-2 py-2 text-xs">
                            <span className="font-medium">{parts.gene}</span> <span className="text-ink-3">· {parts.evidence}</span>
                            <div className="text-ink-2">{parts.call ?? parts.about}</div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
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
