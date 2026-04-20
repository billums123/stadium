import { motion } from "framer-motion";

type Props = {
  phase: "idle" | "warming" | "live" | "stopping";
  onStart: () => void;
  onStop: () => void;
};

export function BroadcastButton({ phase, onStart, onStop }: Props) {
  const live = phase === "live" || phase === "warming";
  return (
    <button
      onClick={live ? onStop : onStart}
      disabled={phase === "stopping" || phase === "warming"}
      className={`group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 transition ${
        live
          ? "border-[var(--color-blaze)] bg-[var(--color-blaze)]/20"
          : "border-[var(--color-chalk)] bg-[var(--color-chalk)] text-[var(--color-ink)]"
      }`}
      aria-label={live ? "Stop broadcast" : "Start broadcast"}
    >
      {!live && (
        <motion.span
          className="absolute inset-0 rounded-full bg-[var(--color-chalk)]"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ opacity: 0.2 }}
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
    </button>
  );
}
