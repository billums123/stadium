import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MILE_METERS,
  PRESET_GOALS,
  formatGoalDistance,
  formatGoalTime,
  type Goal,
  type GoalUnit,
} from "../lib/goal";
import { possessiveSlot } from "../lib/timeOfDay";
import type { UnitSystem } from "../lib/units";

type Props = {
  goal: Goal | null;
  onChange: (goal: Goal | null) => void;
  units: UnitSystem;
};

export function GoalPicker({ goal, onChange, units }: Props) {
  const matchedPresetId = goal
    ? PRESET_GOALS.find(
        (p) =>
          p.goal &&
          p.goal.distanceMeters === goal.distanceMeters &&
          p.goal.timeMs === goal.timeMs
      )?.id ?? "custom"
    : "free";

  const [customOpen, setCustomOpen] = useState(matchedPresetId === "custom");

  return (
    <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/70 p-4 scanline">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display text-xs uppercase tracking-[0.3em] text-[var(--color-volt)]">
          {possessiveSlot()} goal
        </div>
        {goal && (
          <div className="font-display text-[11px] uppercase tracking-[0.25em] text-[var(--color-chalk)]/70">
            {formatGoalDistance(goal, units)} · {formatGoalTime(goal)}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESET_GOALS.map((preset) => {
          const active = matchedPresetId === preset.id && !customOpen;
          return (
            <motion.button
              key={preset.id}
              type="button"
              whileTap={{ scale: 0.93 }}
              animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 0.22 }}
              onClick={() => {
                setCustomOpen(false);
                onChange(preset.goal);
              }}
              className={`min-h-[48px] rounded-lg border px-3.5 py-2.5 font-display text-sm uppercase tracking-[0.18em] transition-colors ${
                active
                  ? "border-[var(--color-blaze)] bg-[var(--color-blaze)]/15 text-[var(--color-chalk)]"
                  : "border-[var(--color-line)] bg-[var(--color-ink)]/60 text-[var(--color-chalk)]/85 hover:border-[var(--color-chalk)]/50"
              }`}
            >
              {preset.label}
            </motion.button>
          );
        })}
        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={() => setCustomOpen((v) => !v)}
          className={`min-h-[48px] rounded-lg border px-3.5 py-2.5 font-display text-sm uppercase tracking-[0.18em] transition-colors ${
            customOpen || matchedPresetId === "custom"
              ? "border-[var(--color-volt)] bg-[var(--color-volt)]/15 text-[var(--color-chalk)]"
              : "border-[var(--color-line)] bg-[var(--color-ink)]/60 text-[var(--color-chalk)]/85 hover:border-[var(--color-chalk)]/50"
          }`}
          aria-expanded={customOpen}
        >
          custom…
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {customOpen && (
          <motion.div
            key="custom"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <CustomGoalForm goal={goal} onChange={onChange} units={units} />
          </motion.div>
        )}
      </AnimatePresence>

      {goal && !customOpen && (
        <div className="mt-3 text-[12px] leading-snug text-[var(--color-chalk)]/70">
          The commentator will track your progress against this target and react to
          every second you're ahead — or behind.
        </div>
      )}
    </section>
  );
}

function CustomGoalForm({ goal, onChange, units: _units }: Props) {
  // Seed from current goal, otherwise a reasonable default (¼ mi / 90 s).
  const seedMeters = goal?.distanceMeters ?? 0.25 * MILE_METERS;
  const seedMs = goal?.timeMs ?? 90_000;
  const seedUnit: GoalUnit = goal?.unit ?? "mi";

  const [unit, setUnit] = useState<GoalUnit>(seedUnit);
  const [amount, setAmount] = useState<string>(() =>
    formatAmountForUnit(seedMeters, seedUnit)
  );
  const [minutes, setMinutes] = useState<string>(String(Math.floor(seedMs / 60_000)));
  const [seconds, setSeconds] = useState<string>(String(Math.round((seedMs % 60_000) / 1000)));

  // Commit the seed goal on first render so the helper line shows a real
  // target immediately — user shouldn't have to touch a field to see it.
  useEffect(() => {
    if (goal) return;
    onChange({ distanceMeters: seedMeters, timeMs: seedMs, unit: seedUnit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next: {
    amount?: string;
    unit?: GoalUnit;
    minutes?: string;
    seconds?: string;
  }) => {
    const nextUnit = next.unit ?? unit;
    const nextAmountStr = next.amount ?? amount;
    const nextMinStr = next.minutes ?? minutes;
    const nextSecStr = next.seconds ?? seconds;

    const amountNum = parseFloat(nextAmountStr);
    const minNum = parseInt(nextMinStr, 10);
    const secNum = parseInt(nextSecStr, 10);

    if (!Number.isFinite(amountNum) || amountNum <= 0) return;
    if (!Number.isFinite(minNum) && !Number.isFinite(secNum)) return;

    const distanceMeters = nextUnit === "mi" ? amountNum * MILE_METERS : amountNum * 1000;
    const timeMs =
      (Number.isFinite(minNum) ? minNum : 0) * 60_000 +
      (Number.isFinite(secNum) ? secNum : 0) * 1000;
    if (timeMs < 5_000) return; // 5s floor

    onChange({ distanceMeters, timeMs, unit: nextUnit });
  };

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)]/70 p-3">
      <div className="mb-2 font-display text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
        custom goal
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
            distance
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              commit({ amount: e.target.value });
            }}
            className="w-full min-h-[44px] rounded-md border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 font-mono text-base text-[var(--color-chalk)] outline-none focus:border-[var(--color-blaze)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
            unit
          </label>
          <div className="flex h-[44px] overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-ink-2)]">
            {(["mi", "km"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setUnit(u);
                  commit({ unit: u });
                }}
                className={`px-3 font-display text-sm uppercase tracking-[0.2em] ${
                  unit === u
                    ? "bg-[var(--color-blaze)]/25 text-[var(--color-chalk)]"
                    : "text-[var(--color-chalk)]/70"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
            minutes
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
              commit({ minutes: e.target.value });
            }}
            className="w-full min-h-[44px] rounded-md border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 font-mono text-base text-[var(--color-chalk)] outline-none focus:border-[var(--color-blaze)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
            seconds
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            step={1}
            value={seconds}
            onChange={(e) => {
              setSeconds(e.target.value);
              commit({ seconds: e.target.value });
            }}
            className="w-full min-h-[44px] rounded-md border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 font-mono text-base text-[var(--color-chalk)] outline-none focus:border-[var(--color-blaze)]"
          />
        </div>
      </div>

      <div className="mt-2 text-[11px] leading-snug text-[var(--color-crowd)]">
        {goal ? (
          <>Target: <span className="text-[var(--color-chalk)]">{formatGoalDistance(goal)}</span> in <span className="text-[var(--color-chalk)]">{formatGoalTime(goal)}</span>.</>
        ) : (
          "Enter a distance and time."
        )}
      </div>
    </div>
  );
}

function formatAmountForUnit(meters: number, unit: GoalUnit): string {
  if (unit === "mi") {
    const mi = meters / MILE_METERS;
    return trim(mi);
  }
  return trim(meters / 1000);
}

function trim(n: number): string {
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, "");
}
