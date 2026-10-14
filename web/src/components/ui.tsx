import { AnimatePresence, motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-3">{children}</h2>
      {aside}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-1 truncate">
        <span className="text-xl font-semibold tabular-nums tracking-tight text-ink">{value}</span>
        {unit && <span className="text-xs text-ink-3">{unit}</span>}
      </div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/60" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            className={`relative m-0 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-pop sm:m-4 sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              <button onClick={onClose} className="btn-ghost -mr-2 h-9 w-9 rounded-full p-0" aria-label="Close">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line px-6 py-12 text-center">
      <div className="text-3xl">{icon}</div>
      <div className="mt-3 font-medium text-ink">{title}</div>
      {body && <div className="mt-1 max-w-sm text-sm text-ink-3">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-2 border-t-ink ${className}`} />;
}

export function Ring({ percent, size = 44, stroke = 4, children }: { percent: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, percent));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={p >= 1 ? "var(--good)" : "var(--series-1)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums">{children}</div>
    </div>
  );
}

export function useToast() {
  return (msg: string, kind: "ok" | "err" = "ok") => {
    window.dispatchEvent(new CustomEvent("sentience:toast", { detail: { msg, kind } }));
  };
}
