import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Settings } from "../lib/store";
import { listVoices, type Voice } from "../lib/elevenlabs";
import { MODEL_OPTIONS } from "../lib/llm";
import { haptic } from "../lib/haptics";

type Props = {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};

const PRESET_VOICES: Voice[] = [
  // Custom (account-owned) voice for this deploy.
  { voice_id: "teSzrMn7PRfLv5Q5Fkob", name: "Hype Sports Announcer (custom)" },
  // Shared-library additions tuned for broadcast energy.
  { voice_id: "1GCQiLWWVadqyDYY3CK9", name: "George Daigle — Southern broadcast baritone" },
  { voice_id: "DcLiO3XaUWTu3gyon6hW", name: "Ninja — hype esports commentator" },
  { voice_id: "FlH8mWLKvKQDtLz1ANa9", name: "Jeet — expert sports commentator" },
  { voice_id: "xuiKYsOhCzCAyIdb1aX3", name: "Clint Brooks — clear southern baritone" },
  // Stock ElevenLabs voices available on every plan.
  { voice_id: "JBFqnCBsd6RMkjVDRZzb", name: "George — broadcast baritone (stock)" },
  { voice_id: "cgSgspJ2msm6clMCkdW9", name: "Jessica — energetic host" },
  { voice_id: "iP95p4xoKVk53GoZ742B", name: "Chris — hype MC" },
  { voice_id: "nPczCjzI2devNBz1zQrb", name: "Brian — deep narrator" },
  { voice_id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel — stadium anchor" },
];

export function SettingsSheet({ open, onClose, settings, update }: Props) {
  const [voices, setVoices] = useState<Voice[]>(PRESET_VOICES);

  // When the sheet opens, try to expand the voice picker with the live
  // account voice list (includes any generated voices on the operator's
  // account). Falls back silently to presets if the backend key is bad.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await listVoices();
        if (cancelled || !v.length) return;
        const merged = [
          ...v.slice(0, 24),
          ...PRESET_VOICES.filter((p) => !v.find((x) => x.voice_id === p.voice_id)),
        ];
        setVoices(merged);
      } catch {
        /* keep presets */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-[var(--color-line)] bg-[var(--color-ink-2)] px-4 pb-[max(env(safe-area-inset-bottom,1rem),1.25rem)] pt-4 sm:px-5"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-line)]" />
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-3xl text-[var(--color-chalk)]">BROADCAST</h2>
              <button
                onClick={onClose}
                className="min-h-[36px] px-2 text-xs uppercase tracking-[0.25em] text-[var(--color-crowd)] hover:text-[var(--color-chalk)]"
              >
                close
              </button>
            </div>

            <Field label="Play-by-play voice">
              <select
                value={settings.voiceId}
                onChange={(e) => {
                  haptic("tap");
                  update({ voiceId: e.target.value });
                }}
                className="w-full min-h-[44px] rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 font-mono text-sm text-[var(--color-chalk)] outline-none focus:border-[var(--color-blaze)]"
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Color commentator voice">
              <select
                value={settings.colorVoiceId}
                onChange={(e) => {
                  haptic("tap");
                  update({ colorVoiceId: e.target.value });
                }}
                className="w-full min-h-[44px] rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 font-mono text-sm text-[var(--color-chalk)] outline-none focus:border-[var(--color-blaze)]"
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] leading-snug text-[var(--color-crowd)]">
                Second voice. Drops a dry aside after play-by-play beats.
              </div>
            </Field>

            <Field label={`Hype floor · ${settings.hypeLevel}`}>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={settings.hypeLevel}
                onChange={(e) => update({ hypeLevel: Number(e.target.value) })}
                className="w-full accent-[var(--color-blaze)]"
              />
              <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
                <span>chill</span>
                <span>chaos</span>
              </div>
              <div className="mt-1 text-[11px] leading-snug text-[var(--color-crowd)]">
                Baseline; the commentator climbs past it on surges and at goal-wire.
              </div>
            </Field>

            <label className="mb-3 flex min-h-[60px] items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5">
              <div>
                <div className="font-display text-xs uppercase tracking-[0.25em] text-[var(--color-chalk)]">
                  dynamic lines
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-[var(--color-crowd)]">
                  Generate each line fresh from GPT-5.4. Templates fill in on timeout.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.useDynamic}
                onChange={(e) => {
                  haptic("tap");
                  update({ useDynamic: e.target.checked });
                }}
                className="h-5 w-5 accent-[var(--color-blaze)]"
              />
            </label>

            <label className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5">
              <div>
                <div className="font-display text-xs uppercase tracking-[0.25em] text-[var(--color-chalk)]">
                  mic quotes · earbuds only
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-[var(--color-crowd)]">
                  Lets the commentator quote what you say out loud. Opening the mic on a phone engages echo cancellation on every playback — so your commentary will sound robotic unless you wear earbuds. Off by default.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.useMic}
                onChange={(e) => {
                  haptic("tap");
                  update({ useMic: e.target.checked });
                }}
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-blaze)]"
              />
            </label>

            <Field label="LLM model">
              <select
                value={settings.llmModel}
                onChange={(e) => update({ llmModel: e.target.value })}
                className="w-full min-h-[44px] rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 font-mono text-sm text-[var(--color-chalk)] outline-none focus:border-[var(--color-blaze)]"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.note}
                  </option>
                ))}
              </select>
            </Field>

            <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-4 text-sm text-[var(--color-chalk)]/80">
              <div className="font-display text-lg tracking-wider text-[var(--color-chalk)]">
                HOW TO USE
              </div>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-snug">
                <li>Pick tonight's goal. Or pick Free Run.</li>
                <li>Phone in a pocket or chest holder. Earbuds in.</li>
                <li>Hit <span className="text-[var(--color-volt)] font-display">GO</span>. Start moving.</li>
                <li>Shout things into your collar mic — the broadcast reacts.</li>
                <li>Hit <span className="text-[var(--color-volt)] font-display">HYPE</span> for on-demand drama.</li>
                <li>Don't forget to hit record on your other phone.</li>
              </ol>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <div className="mb-1.5 font-display text-xs uppercase tracking-[0.25em] text-[var(--color-crowd)]">
        {label}
      </div>
      {children}
    </label>
  );
}
