import { motion } from "framer-motion";
import type { BroadcastStatus } from "../hooks/useBroadcast";
import { HypeMeter } from "./HypeMeter";

type Props = {
  status: BroadcastStatus;
  athleteName: string;
};

function fmtDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function Scoreboard({ status, athleteName }: Props) {
  const { motion: mo, hypeScore, speaking } = status;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/95 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] scanline">
      <div className="flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-[var(--color-crowd)]">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-blaze)] opacity-75 pulse-ring"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-blaze)]"></span>
          </span>
          LIVE — STADIUM CH. 01
        </span>
        <span className="flicker text-[var(--color-chalk)]/70">REC · CAM 1</span>
      </div>

      <div className="flex items-end justify-between gap-3 px-4 pb-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">Athlete</div>
          <div className="font-display text-[clamp(1.9rem,7vw,3rem)] leading-none text-[var(--color-chalk)] truncate">
            {athleteName || "THE ATHLETE"}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">Hype</div>
          <motion.div
            key={hypeScore}
            initial={{ scale: 0.95, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="font-display text-[clamp(1.9rem,7vw,3rem)] leading-none text-[var(--color-volt)]"
          >
            {hypeScore}
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-[var(--color-line)] border-t border-[var(--color-line)]">
        <Stat label="Time" value={fmtDuration(mo.elapsedMs)} accent={speaking ? "blaze" : "chalk"} />
        <Stat label="Distance" value={fmtDistance(mo.distanceMeters)} accent="chalk" />
        <Stat label="Pace" value={`${mo.paceKmh.toFixed(1)} kmh`} accent={mo.paceKmh > 8 ? "volt" : "chalk"} />
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
    <div className="bg-[var(--color-ink-2)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-crowd)]">{label}</div>
      <div className={`font-display text-2xl leading-none ${color}`}>{value}</div>
    </div>
  );
}
