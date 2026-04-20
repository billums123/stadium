import { motion } from "framer-motion";

export function HypeMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct > 75 ? "var(--color-blaze)" : pct > 45 ? "var(--color-volt)" : "var(--color-chalk)";
  return (
    <div className="px-4 pb-2">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
        <span>hype meter</span>
        <span>{pct}/100</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-ink)]/60">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%`, backgroundColor: color }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
          className="h-full"
        />
      </div>
    </div>
  );
}
