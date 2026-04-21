import { AnimatePresence, motion } from "framer-motion";

type Props = {
  /** null = not visible; 3/2/1 = numeric; 0 = "GO!" flash */
  value: number | null;
};

/**
 * Full-screen countdown. The outer overlay + backdrop persist for the
 * whole sequence so the page underneath never bleeds through between
 * ticks; only the number itself swaps, with entry + exit overlapping
 * so the old glyph is still fading out while the new one is scaling in.
 */
export function CountdownOverlay({ value }: Props) {
  const active = value != null;
  const isHorn = value === 0;
  const label = value === 0 ? "GO!" : value?.toString();

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="countdown"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          {/* Persistent backdrop — color shifts to blaze on the horn */}
          <motion.div
            className="absolute inset-0"
            initial={false}
            animate={{
              background: isHorn
                ? "radial-gradient(circle at 50% 45%, rgba(255,59,31,0.55), rgba(5,5,5,0.92) 70%)"
                : "radial-gradient(circle at 50% 45%, rgba(245,255,31,0.22), rgba(5,5,5,0.94) 75%)",
            }}
            transition={{ duration: 0.25 }}
          />

          {/* Number — overlapping swap so the page never peeks through */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`n-${value}`}
              className={`absolute font-display leading-none ${
                isHorn ? "text-[var(--color-blaze)]" : "text-[var(--color-volt)]"
              }`}
              style={{
                fontSize: "clamp(12rem, 60vw, 22rem)",
                textShadow: "0 0 60px rgba(0,0,0,0.85)",
              }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, mass: 0.8 }}
            >
              {label}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
