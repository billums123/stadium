import { AnimatePresence, motion } from "framer-motion";
import type { Line } from "../lib/commentary";

export function CaptionStream({ line, speaking }: { line: Line | null; speaking: boolean }) {
  const urgencyAccent = line
    ? line.urgency === 3
      ? "border-[var(--color-blaze)] text-[var(--color-chalk)]"
      : line.urgency === 2
      ? "border-[var(--color-volt)]/70 text-[var(--color-chalk)]"
      : "border-[var(--color-line)] text-[var(--color-chalk)]/90"
    : "border-[var(--color-line)] text-[var(--color-crowd)]";

  const voiceLabel =
    line?.voice === "color"
      ? "COLOR COMMENTATOR"
      : line?.voice === "play"
      ? "PLAY-BY-PLAY"
      : "PLAY-BY-PLAY";

  return (
    <div className="relative w-full">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        <span className={line?.voice === "color" ? "text-[var(--color-volt)]/80" : ""}>{voiceLabel}</span>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={line?.text ?? "idle"}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={`relative rounded-xl border-2 ${urgencyAccent} bg-[var(--color-ink-2)]/80 px-4 py-4 backdrop-blur`}
        >
          <div className="font-display text-[clamp(1.3rem,5.5vw,2.1rem)] leading-[1.08] text-balance">
            {line ? line.text : "Awaiting broadcast. Press the button."}
          </div>
          {speaking && (
            <motion.div
              className="mt-3 flex items-end gap-1 text-[var(--color-blaze)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={i}
                  className="w-[3px] rounded-sm bg-current"
                  animate={{ height: [4, 16, 8, 14, 6] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.08 }}
                />
              ))}
              <span className="ml-2 text-[10px] uppercase tracking-[0.25em]">On air</span>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
