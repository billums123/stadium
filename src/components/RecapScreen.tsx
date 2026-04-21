import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { BroadcastStatus } from "../hooks/useBroadcast";
import { haptic } from "../lib/haptics";
import { shareCard } from "../lib/sharecard";
import { stripAudioTags } from "../lib/tags";
import { formatGoalDistance, formatGoalTime } from "../lib/goal";

type Props = {
  status: BroadcastStatus;
  onNewBroadcast: () => void;
};

function fmtTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function RecapScreen({ status, onNewBroadcast }: Props) {
  const recap = status.recap;
  const [sharing, setSharing] = useState(false);

  if (!recap) return null;

  const isComplete = recap.goalOutcome === "complete";
  const isFailed = recap.goalOutcome === "failed";
  const outcomeLabel =
    isComplete ? "GOAL HIT" : isFailed ? "CLOCK GONE" : "FREE RUN · LOGGED";
  const outcomeColor = isComplete
    ? "text-[var(--color-volt)]"
    : isFailed
    ? "text-[var(--color-blaze)]"
    : "text-[var(--color-chalk)]";

  const onShare = async () => {
    if (sharing) return;
    haptic("press");
    setSharing(true);
    try {
      const result = await shareCard({
        athleteName: recap.athleteName,
        line: recap.closingLine,
        motion: status.motion,
        hypeScore: recap.peakHype,
        recap,
      });
      if (result === "shared" || result === "downloaded") haptic("success");
    } catch {
      haptic("fail");
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    // Mark the entry with haptics — confetti is handled app-level.
    if (isComplete) haptic("success");
    else if (isFailed) haptic("fail");
    else haptic("press");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-3"
    >
      {/* Hero bar */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/90 p-4 scanline">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-chalk)]/50" />
          <span>final whistle · stadium</span>
        </div>
        <div className="mt-1 font-display text-[clamp(1.8rem,7vw,2.6rem)] leading-tight text-[var(--color-chalk)]">
          {recap.athleteName}
        </div>
        <div className={`mt-1 font-display text-base uppercase tracking-[0.2em] ${outcomeColor}`}>
          {outcomeLabel}
        </div>
      </div>

      {/* Core stats */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)]">
        <Stat label="Time" value={fmtTime(recap.totalTimeMs)} />
        <Stat label="Distance" value={fmtDistance(recap.totalDistanceM)} />
        <Stat
          label="Avg pace"
          value={`${recap.avgKmh.toFixed(1)} kmh`}
          accent={recap.avgKmh > 8 ? "volt" : "chalk"}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)]">
        <Stat label="Peak pace" value={`${recap.peakKmh.toFixed(1)} kmh`} accent="volt" />
        <Stat label="Peak hype" value={`${recap.peakHype}/100`} accent="blaze" />
      </div>

      {recap.goal && (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/80 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
            tonight's goal
          </div>
          <div className="font-display text-base leading-tight text-[var(--color-chalk)]">
            {formatGoalDistance(recap.goal)} · {formatGoalTime(recap.goal)}
          </div>
        </div>
      )}

      {/* Closing line */}
      <div className="rounded-xl border-2 border-[var(--color-blaze)] bg-[var(--color-ink-2)]/85 px-4 py-4">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
          <span className="h-px flex-1 bg-[var(--color-line)]" />
          <span>closing beat</span>
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>
        <div className="font-display text-[clamp(1.1rem,4.8vw,1.8rem)] leading-[1.15] text-[var(--color-chalk)]">
          {recap.closingLine
            ? stripAudioTags(recap.closingLine.text)
            : "The commentator is gathering their thoughts…"}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <motion.button
          type="button"
          onClick={onShare}
          disabled={sharing}
          whileTap={{ scale: 0.96 }}
          className="min-h-[56px] rounded-lg border-2 border-[var(--color-chalk)] bg-[var(--color-chalk)] font-display text-base uppercase tracking-[0.18em] text-[var(--color-ink)] active:scale-95 disabled:opacity-60"
        >
          {sharing ? "rendering…" : "◉ photo finish"}
        </motion.button>
        <motion.button
          type="button"
          onClick={() => {
            haptic("press");
            onNewBroadcast();
          }}
          whileTap={{ scale: 0.96 }}
          className="min-h-[56px] rounded-lg border-2 border-[var(--color-blaze)] bg-[var(--color-blaze)]/10 font-display text-base uppercase tracking-[0.18em] text-[var(--color-blaze)]"
        >
          new broadcast
        </motion.button>
      </div>
    </motion.section>
  );
}

function Stat({
  label,
  value,
  accent = "chalk",
}: {
  label: string;
  value: string;
  accent?: "chalk" | "volt" | "blaze";
}) {
  const color =
    accent === "volt"
      ? "text-[var(--color-volt)]"
      : accent === "blaze"
      ? "text-[var(--color-blaze)]"
      : "text-[var(--color-chalk)]";
  return (
    <div className="bg-[var(--color-ink-2)] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-crowd)]">{label}</div>
      <div className={`font-display text-xl leading-tight sm:text-2xl ${color}`}>{value}</div>
    </div>
  );
}
