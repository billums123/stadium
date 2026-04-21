import { AnimatePresence, motion } from "framer-motion";

type Props = {
  /** null = not visible; 3/2/1 = numeric; 0 = "GO!" flash */
  value: number | null;
};

export function CountdownOverlay({ value }: Props) {
  const label = value === 0 ? "GO!" : value?.toString();
  const isHorn = value === 0;

  return (
    <AnimatePresence>
      {value != null && (
        <motion.div
          key="countdown"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Radial flash — louder on GO */}
          <motion.div
            key={`bg-${value}`}
            className="absolute inset-0"
            style={{
              background: isHorn
                ? "radial-gradient(circle at 50% 45%, rgba(255,59,31,0.55), rgba(5,5,5,0.85) 70%)"
                : "radial-gradient(circle at 50% 45%, rgba(245,255,31,0.22), rgba(5,5,5,0.9) 75%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          <motion.div
            key={`n-${value}`}
            className={`relative font-display leading-none ${
              isHorn ? "text-[var(--color-blaze)]" : "text-[var(--color-volt)]"
            }`}
            style={{
              fontSize: "clamp(12rem, 60vw, 22rem)",
              textShadow: "0 0 60px rgba(0,0,0,0.8)",
            }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
          >
            {label}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
