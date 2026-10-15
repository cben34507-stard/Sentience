import { LAB_TEST_BY_KEY, labFlag, type LabResult, type Supplement, type SupplementEvidence } from "@sentience/shared";
import { fmtNum } from "../lib/date";
import { FlagBadge } from "./LabCharts";

const EVIDENCE: Record<SupplementEvidence, { label: string; cls: string }> = {
  strong: { label: "Strong evidence", cls: "bg-accent text-paper" },
  moderate: { label: "Moderate evidence", cls: "border border-line-2 text-ink" },
  weak: { label: "Weak evidence", cls: "border border-line text-ink-3" },
};

export function EvidenceChip({ e }: { e: SupplementEvidence }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${EVIDENCE[e].cls}`}>{EVIDENCE[e].label}</span>;
}

/** "Weeks 8–12" → day 49. Steps are ordered, so the last one started is "now". */
function stepStartDay(when: string): number {
  const m = /(day|week|month|year)s?\s*(\d+)/i.exec(when);
  if (!m) return 0;
  const n = Number(m[2]);
  const unit = m[1].toLowerCase();
  if (unit === "day") return n - 1;
  if (unit === "week") return (n - 1) * 7;
  if (unit === "month") return (n - 1) * 30;
  return (n - 1) * 365;
}

/**
 * What the supplement is for, how strong the evidence is, and where you are on
 * its timeline if you keep taking it, plus your own related test results.
 */
export function SupplementGuide({ s, daysSinceStart, adherence, labs }: { s: Supplement; daysSinceStart?: number; adherence?: number | null; labs?: LabResult[] }) {
  const starts = s.timeline.map((t) => stepStartDay(t.when));
  let current = -1;
  if (daysSinceStart != null) starts.forEach((d, i) => d <= daysSinceStart && (current = i));
  const related = (s.relatedLabs ?? [])
    .map((k) => {
      const rs = (labs ?? []).filter((l) => l.testKey === k).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
      return { key: k, preset: LAB_TEST_BY_KEY[k], latest: rs[0] };
    })
    .filter((r) => r.preset);

  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold tracking-tight">{s.name}</h3>
          <EvidenceChip e={s.evidence} />
        </div>
        <p className="mt-1.5 text-ink-2">{s.summary}</p>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">What it can do</div>
        <ul className="space-y-1.5">
          {s.benefits.map((b, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <span className="text-ink-2">{b.text}</span>
              <EvidenceChip e={b.evidence} />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">If you stick with it</div>
          {daysSinceStart != null && (
            <div className="text-xs text-ink-3">
              Day {daysSinceStart + 1}
              {adherence != null && ` · taken ${Math.round(adherence * 100)}% of doses in the last 30 days`}
            </div>
          )}
        </div>
        <ol className="relative space-y-3 border-l border-line pl-5">
          {s.timeline.map((t, i) => {
            const here = i === current;
            const past = i < current;
            return (
              <li key={i} className="relative">
                <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 ${here ? "border-[var(--series-1)] bg-[var(--series-1)]" : past ? "border-ink-3 bg-ink-3" : "border-line-2 bg-paper"}`} />
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-semibold ${here ? "text-ink" : "text-ink-3"}`}>{t.when}</span>
                  {here && <span className="rounded-full bg-paper-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">You are here</span>}
                </div>
                <p className={here ? "text-ink" : "text-ink-2"}>{t.what}</p>
              </li>
            );
          })}
        </ol>
        {adherence != null && adherence < 0.7 && daysSinceStart != null && daysSinceStart > 6 && (
          <p className="mt-2 text-xs text-warn">These timings assume most days. At {Math.round(adherence * 100)}% of doses, expect things to take longer.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">How to take it</div>
          <p className="text-ink-2">{s.howToTake}</p>
          <p className="mt-1 text-xs text-ink-3">Typical dose: {s.typicalDose}</p>
        </div>
        {s.ukGuidance && (
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">UK guidance</div>
            <p className="text-ink-2">{s.ukGuidance}</p>
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Your related results</div>
          <div className="divide-y divide-line rounded-xl border border-line">
            {related.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>{r.preset.name}</span>
                {r.latest ? (
                  <span className="flex items-center gap-2 tabular-nums">
                    {r.latest.value != null ? fmtNum(r.latest.value, 2) : r.latest.valueText} <span className="text-xs text-ink-3">{r.latest.unit}</span>
                    <span className="text-xs text-ink-3">{new Date(r.latest.takenAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
                    <FlagBadge flag={labFlag(r.latest)} />
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">no result yet: worth a test before and after</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {s.cautions.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Check first</div>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">
            {s.cautions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-ink-3">General information, not personal medical advice. Check with a pharmacist if you take prescribed medicines.</p>
    </div>
  );
}
