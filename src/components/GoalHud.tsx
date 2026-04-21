import { motion } from "framer-motion";
import type { GoalProgress } from "../lib/goal";
import { formatGoalDistance, formatGoalTime } from "../lib/goal";

type Props = {
  progress: GoalProgress | null;
};

export function GoalHud({ progress }: Props) {
  if (!progress) return null;

  const { goal, distancePct, timePct, metersAhead, timeLeftMs, status } = progress;
  const distMarker = Math.max(0, Math.min(100, distancePct * 100));
  const timeMarker = Math.max(0, Math.min(100, timePct * 100));
  const leadColor =
    status === "complete"
      ? "text-[var(--color-volt)]"
      : status === "failed"
      ? "text-[var(--color-blaze)]"
      : metersAhead > 2
      ? "text-[var(--color-volt)]"
      : metersAhead < -2
      ? "text-[var(--color-blaze)]"
      : "text-[var(--color-chalk)]";

  const leadText =
    status === "complete"
      ? "GOAL HIT"
      : status === "failed"
      ? "CLOCK GONE"
      : metersAhead > 2
      ? `+${Math.round(metersAhead)} m`
      : metersAhead < -2
      ? `${Math.round(metersAhead)} m`
      : "on pace";

  const timeLeftText =
    timeLeftMs >= 0
      ? `${Math.ceil(timeLeftMs / 1000)} s left`
      : `${Math.abs(Math.ceil(timeLeftMs / 1000))} s over`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/80 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">goal</div>
          <div className="font-display text-base leading-tight text-[var(--color-chalk)] sm:text-lg sm:leading-none truncate">
            {formatGoalDistance(goal)} · {formatGoalTime(goal)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`font-display text-base leading-tight sm:text-lg sm:leading-none ${leadColor}`}>{leadText}</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
            {timeLeftText}
          </div>
        </div>
      </div>

      <div className="mt-2.5 sm:mt-3">
        <div className="relative h-3 overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-ink)]/70">
          <motion.div
            className="absolute inset-y-0 left-0 bg-[var(--color-volt)]/60"
            initial={false}
            animate={{ width: `${distMarker}%` }}
            transition={{ type: "spring", stiffness: 160, damping: 22 }}
          />
          <div
            className="absolute inset-y-0 w-[2px] bg-[var(--color-blaze)]"
            style={{ left: `${timeMarker}%` }}
            aria-label="Expected progress marker"
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
          <span>you</span>
          <span>expected</span>
        </div>
      </div>
    </div>
  );
}
