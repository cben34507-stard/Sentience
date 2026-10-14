import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  /** Secondary text shown under the label. */
  hint?: string;
  group?: string;
  icon?: ReactNode;
}

interface Props<V extends string> {
  value: V;
  onChange: (v: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  /** Show a filter box; on by default for long lists. */
  searchable?: boolean;
  className?: string;
  name?: string;
  "aria-label"?: string;
}

/**
 * Themed replacement for <select>. Opens a portal-rendered listbox so it is
 * never clipped by modals, supports type-to-filter, arrow keys, Home/End,
 * Enter and Escape, and flips upward when there's no room below.
 */
export function Select<V extends string>({ value, onChange, options, placeholder = "Choose…", searchable, className = "", name, ...aria }: Props<V>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxH: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const showSearch = searchable ?? options.length > 12;

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 240 && above > below;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: Math.max(r.width, 220), maxH: Math.min(360, up ? above : below), up });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const i = Math.max(0, filtered.findIndex((o) => o.value === value));
    setActive(i);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (btn.current?.contains(e.target as Node) || list.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    if (showSearch) setTimeout(() => input.current?.focus(), 10);
    else setTimeout(() => list.current?.focus(), 10);
    return () => document.removeEventListener("mousedown", h);
  }, [open, showSearch]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    btn.current?.focus();
  };
  const choose = (o: SelectOption<V>) => {
    onChange(o.value);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o) choose(o);
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close();
    } else if (!showSearch && e.key.length === 1) {
      // Type-ahead jump on short lists.
      const i = filtered.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  let lastGroup: string | undefined;

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={btn}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={aria["aria-label"]}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`field flex items-center justify-between gap-2 text-left ${open ? "border-line-2 ring-4 ring-paper-3" : ""} ${className}`}
      >
        <span className={`flex min-w-0 items-center gap-2 truncate ${selected ? "" : "text-ink-3"}`}>
          {selected?.icon}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={list}
              id={id}
              role="listbox"
              tabIndex={-1}
              onKeyDown={onKey}
              initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                left: Math.min(pos.left, window.innerWidth - pos.width - 8),
                width: pos.width,
                ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
                transformOrigin: pos.up ? "bottom" : "top",
              }}
              className="z-[80] overflow-hidden rounded-2xl border border-line bg-paper shadow-pop outline-none"
            >
              {showSearch && (
                <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                  <Search className="h-4 w-4 text-ink-3" />
                  <input
                    ref={input}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onKey}
                    placeholder="Search"
                    className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-ink-3"
                  />
                </div>
              )}
              <div className="overflow-y-auto p-1.5" style={{ maxHeight: pos.maxH - (showSearch ? 48 : 0) }}>
                {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-ink-3">No matches</div>}
                {filtered.map((o, i) => {
                  const header = o.group && o.group !== lastGroup ? o.group : null;
                  lastGroup = o.group;
                  const isSel = o.value === value;
                  return (
                    <div key={o.value}>
                      {header && <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{header}</div>}
                      <div
                        role="option"
                        aria-selected={isSel}
                        data-index={i}
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(o)}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${i === active ? "bg-paper-3" : ""}`}
                      >
                        {o.icon && <span className="shrink-0 text-ink-2">{o.icon}</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{o.label}</span>
                          {o.hint && <span className="block truncate text-xs text-ink-3">{o.hint}</span>}
                        </span>
                        {isSel && <Check className="h-4 w-4 shrink-0" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
