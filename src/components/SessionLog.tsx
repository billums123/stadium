import { AnimatePresence, motion } from "framer-motion";
import type { Line } from "../lib/commentary";

export function SessionLog({ history }: { history: Line[] }) {
  if (history.length === 0) return null;
  return (
    <div className="relative w-full">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        <span>broadcast log</span>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>
      <AnimatePresence initial={false}>
        <div className="flex flex-col gap-2">
          {history.slice(1, 5).map((line, i) => (
            <motion.div
              key={line.text + i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 0.7, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-ink-2)]/60 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
                <span className={
                  line.urgency === 3
                    ? "text-[var(--color-blaze)]"
                    : line.urgency === 2
                    ? "text-[var(--color-volt)]"
                    : "text-[var(--color-crowd)]"
                }>
                  {line.trigger}
                </span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[var(--color-chalk)]/80">
                {line.text}
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
