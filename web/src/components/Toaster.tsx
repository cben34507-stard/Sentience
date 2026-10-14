import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "err";
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const h = (e: Event) => {
      const { msg, kind } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener("sentience:toast", h);
    return () => window.removeEventListener("sentience:toast", h);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 16, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-pop ${
              t.kind === "err" ? "bg-bad text-white" : "bg-ink text-paper"
            }`}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
