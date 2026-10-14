import { useEffect, useState } from "react";
import type { Event, EventCategory, EventInput } from "@sentience/shared";
import { EVENT_CATEGORIES, EVENT_CATEGORY_META } from "@sentience/shared";
import { Field, Modal } from "./ui";
import { CategoryIcon } from "./icons";
import { fromInputDateTime, toInputDateTime } from "../lib/date";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: EventInput, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  /** Existing event to edit, or a partial seed for a new one. */
  initial?: Partial<Event> | null;
}

const RANGED: EventCategory[] = ["sleep", "workout", "work", "study", "social", "leisure", "movement"];

export function EventForm({ open, onClose, onSave, onDelete, initial }: Props) {
  const [category, setCategory] = useState<EventCategory>("note");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [tags, setTags] = useState("");
  const [rating, setRating] = useState<string>("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory(initial?.category ?? "note");
    setTitle(initial?.title ?? "");
    setNotes(initial?.notes ?? "");
    setStart(toInputDateTime(initial?.startAt ?? new Date().toISOString()));
    setEnd(initial?.endAt ? toInputDateTime(initial.endAt) : "");
    setTags((initial?.tags ?? []).join(", "));
    setRating(initial?.rating != null ? String(initial.rating) : "");
    setExtra(
      initial?.data && Object.keys(initial.data).length
        ? Object.entries(initial.data)
            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
            .join("\n")
        : "",
    );
    setErr(null);
  }, [open, initial]);

  const isEdit = !!initial?.id;
  const meta = EVENT_CATEGORY_META[category];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const data: Record<string, unknown> = {};
      for (const line of extra.split("\n")) {
        const m = /^\s*([^:]+?)\s*:\s*(.+?)\s*$/.exec(line);
        if (!m) continue;
        const raw = m[2];
        const num = Number(raw);
        data[m[1]] = raw !== "" && !Number.isNaN(num) ? num : raw;
      }
      await onSave(
        {
          category,
          title: title.trim() || meta.label,
          notes: notes.trim() || null,
          startAt: fromInputDateTime(start),
          endAt: end ? fromInputDateTime(end) : null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          rating: rating === "" ? null : Number(rating),
          data,
        },
        initial?.id,
      );
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit event" : "Log event"}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`chip ${category === c ? "!border-ink !bg-ink !text-paper" : ""}`}
              >
                <CategoryIcon category={c} className="h-3.5 w-3.5" />
                {EVENT_CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>

        <Field label="What" hint={meta.hint}>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={meta.label} autoFocus />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Start">
            <input className="field" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label={RANGED.includes(category) ? "End" : "End (optional)"}>
            <input className="field" type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Tags" hint="Comma separated">
            <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="protein, home-cooked" />
          </Field>
          <Field label="Rating 0–10">
            <input className="field" type="number" min={0} max={10} step={1} value={rating} onChange={(e) => setRating(e.target.value)} placeholder="—" />
          </Field>
        </div>

        <Field label="Notes">
          <textarea className="field min-h-[72px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this" />
        </Field>

        <Field label="Details" hint="One per line as key: value — e.g. calories: 620, caffeine_mg: 90, weight_kg: 80">
          <textarea className="field min-h-[56px] resize-y font-mono text-xs" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </Field>

        {err && <div className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}

        <div className="flex items-center justify-between gap-2 pt-2">
          {isEdit && onDelete ? (
            <button
              type="button"
              className="btn-ghost text-bad hover:text-bad"
              onClick={async () => {
                if (!confirm("Delete this event?")) return;
                await onDelete(initial!.id!);
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
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : isEdit ? "Save" : "Log it"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
