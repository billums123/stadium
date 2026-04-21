import { AnimatePresence, motion } from "framer-motion";

type Props = {
  /** True while start() is running and before the first countdown tick. */
  active: boolean;
};

/**
 * Fills the gap between the GO tap and the first countdown beep.
 * The welcome LLM call + TTS decode can take a few seconds; this
 * overlay keeps the screen obviously alive so users aren't staring
 * at a frozen landing page wondering if their tap registered.
 */
export function WarmingOverlay({ active }: Props) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="warming"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(255,59,31,0.22), rgba(5,5,5,0.9) 72%)",
            }}
          />

          <div className="relative flex flex-col items-center gap-5">
            {/* Spinning ring + pulsing center dot */}
            <div className="relative h-28 w-28">
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-[var(--color-line)]"
              />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-transparent"
                style={{
                  borderTopColor: "var(--color-blaze)",
                  borderRightColor: "var(--color-blaze)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-5 rounded-full bg-[var(--color-blaze)]"
                animate={{ scale: [0.85, 1, 0.85], opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <div className="font-display text-[10px] uppercase tracking-[0.5em] text-[var(--color-blaze)]">
              coming on air
            </div>
            <div className="font-display text-[clamp(2.2rem,9vw,4rem)] leading-none text-[var(--color-chalk)]">
              GOING LIVE
            </div>
            <motion.div
              className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--color-chalk)]/70"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              announcer warming up · one moment
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
