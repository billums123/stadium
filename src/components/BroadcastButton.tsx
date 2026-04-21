import { motion } from "framer-motion";

type Props = {
  phase: "idle" | "warming" | "live" | "stopping";
  onStart: () => void;
  onStop: () => void;
};

export function BroadcastButton({ phase, onStart, onStop }: Props) {
  const live = phase === "live" || phase === "warming";

  return (
    <motion.button
      onClick={live ? onStop : onStart}
      disabled={phase === "stopping" || phase === "warming"}
      aria-label={live ? "Stop broadcast" : "Start broadcast"}
      whileTap={{ scale: 0.92 }}
      // Idle: a gentle breath that pulls the eye.
      // Live: steady rest state; the ring animation below handles the vibe.
      animate={
        live
          ? { scale: 1 }
          : { scale: [1, 1.04, 1] }
      }
      transition={
        live
          ? { duration: 0.2 }
          : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
      }
      className={`group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] transition-colors ${
        live
          ? "border-[var(--color-blaze)] bg-[var(--color-blaze)]/20"
          : "border-[var(--color-chalk)] bg-[var(--color-chalk)] text-[var(--color-ink)]"
      }`}
    >
      {/* Idle: a soft halo that grows and fades to draw attention. */}
      {!live && (
        <motion.span
          className="absolute inset-0 rounded-full bg-[var(--color-chalk)]"
          animate={{ scale: [1, 1.35], opacity: [0.25, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {live && (
        <motion.span
          className="absolute -inset-1 rounded-full border-2 border-[var(--color-blaze)]"
          animate={{ scale: [1, 1.35], opacity: [0.8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span className="font-display relative z-10 text-xl uppercase tracking-[0.18em]">
        {live ? "Stop" : "GO"}
      </span>
    </motion.button>
  );
}
