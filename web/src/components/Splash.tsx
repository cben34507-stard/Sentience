import { motion } from "framer-motion";

const WORD = "Sentience".split("");

/**
 * Intro: letters rise in, a pulse line draws beneath like a heartbeat trace,
 * then the whole thing lifts away to reveal the app.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      key="splash"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative flex flex-col items-center">
        <h1 className="flex overflow-hidden text-[clamp(44px,9vw,96px)] font-semibold tracking-[-0.04em] text-ink" aria-label="Sentience">
          {WORD.map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12 + i * 0.045, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>

        <svg className="mt-4 w-[min(70vw,520px)]" viewBox="0 0 520 60" fill="none" aria-hidden>
          <motion.path
            d="M0 30 H170 L190 30 L205 8 L222 52 L238 18 L250 30 H520"
            stroke="currentColor"
            className="text-ink"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.55, duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
            onAnimationComplete={() => setTimeout(onDone, 350)}
          />
          <motion.circle
            r="4"
            className="fill-ink"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ delay: 0.55, duration: 1.1, times: [0, 0.1, 0.9, 1] }}
          >
            <animateMotion dur="1.1s" begin="0.55s" fill="freeze" path="M0 30 H170 L190 30 L205 8 L222 52 L238 18 L250 30 H520" />
          </motion.circle>
        </svg>

        <motion.p
          className="mt-6 text-xs font-medium uppercase tracking-[0.3em] text-ink-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          know your days
        </motion.p>
      </div>
    </motion.div>
  );
}
