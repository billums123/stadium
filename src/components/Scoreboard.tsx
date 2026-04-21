import { motion } from "framer-motion";
import { useState } from "react";
import type { BroadcastStatus } from "../hooks/useBroadcast";
import { HypeMeter } from "./HypeMeter";
import { shareCard } from "../lib/sharecard";
import { haptic } from "../lib/haptics";
import { formatDistance, formatPace, paceIn, type UnitSystem } from "../lib/units";

type Props = {
  status: BroadcastStatus;
  athleteName: string;
  units: UnitSystem;
};

function fmtDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Scoreboard({ status, athleteName, units }: Props) {
  const { motion: mo, hypeScore, speaking, lastLine } = status;
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    if (sharing) return;
    haptic("press");
    setSharing(true);
    try {
      const result = await shareCard({ athleteName, line: lastLine, motion: mo, hypeScore, units });
      if (result === "shared" || result === "downloaded") haptic("success");
    } catch {
      haptic("fail");
    } finally {
      setSharing(false);
    }
  };

  const pacePlain = paceIn(mo.paceKmh, units);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/95 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] scanline">
      <div className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-crowd)]">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-blaze)] opacity-75 pulse-ring"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-blaze)]"></span>
          </span>
          LIVE · CH. 01
        </span>
        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          aria-label="Export photo-finish share card"
          className="min-h-[40px] rounded-lg border border-[var(--color-line)] px-3 font-display text-[12px] uppercase tracking-[0.22em] text-[var(--color-chalk)]/85 transition active:scale-95 hover:border-[var(--color-chalk)]/60 disabled:opacity-50"
        >
          {sharing ? "rendering…" : "◉ SHARE"}
        </button>
      </div>

      <div className="flex items-end justify-between gap-3 px-3 pb-2 sm:px-4 sm:pb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">Athlete</div>
          <div className="font-display text-[clamp(1.7rem,8vw,3rem)] leading-[0.95] text-[var(--color-chalk)] truncate">
            {athleteName || "THE ATHLETE"}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">Hype</div>
          <motion.div
            key={hypeScore}
            initial={{ scale: 0.95, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="font-display text-[clamp(1.7rem,8vw,3rem)] leading-[0.95] text-[var(--color-volt)]"
          >
            {hypeScore}
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-[var(--color-line)] border-t border-[var(--color-line)]">
        <Stat label="Time" value={fmtDuration(mo.elapsedMs)} accent={speaking ? "blaze" : "chalk"} />
        <Stat label="Distance" value={formatDistance(mo.distanceMeters, units)} accent="chalk" />
        <Stat label="Pace" value={formatPace(mo.paceKmh, units)} accent={pacePlain > (units === "imperial" ? 5 : 8) ? "volt" : "chalk"} />
      </div>

      <HypeMeter value={hypeScore} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "chalk" | "volt" | "blaze";
}) {
  const color =
    accent === "blaze"
      ? "text-[var(--color-blaze)]"
      : accent === "volt"
      ? "text-[var(--color-volt)]"
      : "text-[var(--color-chalk)]";
  return (
    <div className="bg-[var(--color-ink-2)] px-2.5 py-1.5 sm:px-3 sm:py-2">
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-crowd)]">{label}</div>
      <div className={`font-display text-xl leading-tight sm:text-2xl sm:leading-none ${color}`}>{value}</div>
    </div>
  );
}
