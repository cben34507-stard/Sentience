import { useEffect, useState } from "react";
import { Activity, Brain, FlaskConical, HeartPulse, Info, Moon, Sparkles, ThumbsUp, TriangleAlert, Utensils, type LucideIcon } from "lucide-react";
import type { Insight } from "@sentience/shared";
import { api } from "../lib/api";
import { Card, Modal, SectionTitle, Spinner } from "./ui";
import { Markdown } from "./Markdown";
import { Link } from "react-router-dom";

const AREA_ICON: Record<Insight["area"], LucideIcon> = { heart: HeartPulse, sleep: Moon, activity: Activity, nutrition: Utensils, tests: FlaskConical, mood: Brain };
const TONE: Record<Insight["tone"], { icon: LucideIcon; cls: string; label: string }> = {
  good: { icon: ThumbsUp, cls: "text-good", label: "Going well" },
  watch: { icon: TriangleAlert, cls: "text-warn", label: "Worth a look" },
  info: { icon: Info, cls: "text-ink-3", label: "Note" },
};

/**
 * Local insights (computed on your server, nothing sent anywhere) plus an
 * optional AI assessment of a date range.
 */
export function Insights({ from, to, compact }: { from?: string; to?: string; compact?: boolean }) {
  const [items, setItems] = useState<Insight[] | null>(null);
  const [ai, setAi] = useState<{ enabled: boolean } | null>(null);
  const [assessment, setAssessment] = useState<{ markdown: string; model: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.insights().then(setItems).catch(() => setItems([]));
    api.ai.status().then(setAi).catch(() => setAi({ enabled: false }));
  }, []);

  const assess = async () => {
    if (!from || !to) return;
    setOpen(true);
    setBusy(true);
    setErr(null);
    setAssessment(null);
    try {
      setAssessment(await api.ai.assess(from, to));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Assessment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <SectionTitle
        aside={
          from && to ? (
            ai?.enabled ? (
              <button className="btn-primary h-8 px-3 text-xs" onClick={assess}>
                <Sparkles className="h-3.5 w-3.5" /> Assess with AI
              </button>
            ) : (
              <Link to="/settings" className="text-xs text-ink-3 hover:text-ink">
                Turn on AI assessments
              </Link>
            )
          ) : null
        }
      >
        Insights
      </SectionTitle>
      {items == null ? (
        <Spinner />
      ) : (
        <div className={`grid grid-cols-1 gap-3 ${compact ? "" : "md:grid-cols-2 2xl:grid-cols-3"}`}>
          {items.map((i) => {
            const A = AREA_ICON[i.area];
            const T = TONE[i.tone];
            return (
              <div key={i.id} className="flex gap-3 rounded-xl border border-line p-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper-3 text-ink-2">
                  <A className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <T.icon className={`h-3.5 w-3.5 shrink-0 ${T.cls}`} aria-label={T.label} />
                    {i.title}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">{i.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-3">Insights are worked out on your own server from the last 5 weeks. They're patterns, not medical advice.</p>

      <Modal open={open} onClose={() => setOpen(false)} title="AI assessment" wide>
        {busy ? (
          <div className="flex flex-col items-center gap-3 py-12 text-sm text-ink-3">
            <Spinner />
            Reading {from} to {to}. This takes up to a minute.
          </div>
        ) : err ? (
          <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>
        ) : assessment ? (
          <div>
            <Markdown text={assessment.markdown} />
            <p className="mt-5 border-t border-line pt-3 text-[11px] text-ink-3">
              Written by {assessment.model} from your export for {from} to {to}. That export was sent to Anthropic's API for this request. Not medical advice.
            </p>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
