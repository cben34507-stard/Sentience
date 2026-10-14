import { AnimatePresence, motion } from "framer-motion";
import type { WavePhase } from "./WaveField";

const WORD = "Sentience".split("");

/**
 * The wordmark that sits in the middle of the strands on first load. The
 * strands themselves are drawn by WaveField; this only handles the text and
 * the soft disc behind it.
 */
export function SplashWordmark({ phase }: { phase: WavePhase }) {
  return (
    <AnimatePresence>
      {phase !== "ambient" && (
        <motion.div
          key="wordmark"
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: phase === "expand" ? 0 : 1, scale: phase === "expand" ? 1.06 : 1, filter: phase === "expand" ? "blur(6px)" : "blur(0px)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: phase === "expand" ? 0.7 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="absolute rounded-full"
            style={{ width: "min(86vw, 640px)", height: "min(40vw, 230px)", background: "radial-gradient(closest-side, var(--paper) 55%, color-mix(in oklab, var(--paper) 60%, transparent) 78%, transparent 100%)" }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="relative flex flex-col items-center">
            <h1 className="flex overflow-hidden text-[clamp(44px,8vw,88px)] font-semibold tracking-[-0.045em] text-ink" aria-label="Sentience">
              {WORD.map((ch, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 + i * 0.05, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                >
                  {ch}
                </motion.span>
              ))}
            </h1>
            <motion.p
              className="mt-3 text-[11px] font-medium uppercase tracking-[0.42em] text-ink-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            >
              know your days
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
