import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Settings } from "../lib/store";
import { listVoices, verifyKey, type Voice } from "../lib/elevenlabs";

type Props = {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};

const PRESET_VOICES: Voice[] = [
  { voice_id: "JBFqnCBsd6RMkjVDRZzb", name: "George — broadcast baritone" },
  { voice_id: "cgSgspJ2msm6clMCkdW9", name: "Jessica — energetic host" },
  { voice_id: "iP95p4xoKVk53GoZ742B", name: "Chris — hype MC" },
  { voice_id: "nPczCjzI2devNBz1zQrb", name: "Brian — deep narrator" },
  { voice_id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel — stadium anchor" },
];

export function SettingsSheet({ open, onClose, settings, update }: Props) {
  const [voices, setVoices] = useState<Voice[]>(PRESET_VOICES);
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "ok" | "bad">("idle");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (!settings.elevenKey) return;
      setKeyStatus("checking");
      const ok = await verifyKey(settings.elevenKey);
      if (cancelled) return;
      setKeyStatus(ok ? "ok" : "bad");
      if (ok) {
        try {
          const v = await listVoices(settings.elevenKey);
          if (!cancelled && v.length) {
            const merged = [...v.slice(0, 20), ...PRESET_VOICES.filter(p => !v.find(x => x.voice_id === p.voice_id))];
            setVoices(merged);
          }
        } catch { /* keep presets */ }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, settings.elevenKey]);

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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-[var(--color-line)] bg-[var(--color-ink-2)] px-5 pb-[max(env(safe-area-inset-bottom,1rem),1.25rem)] pt-4"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-line)]" />
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-3xl text-[var(--color-chalk)]">BROADCAST SETTINGS</h2>
              <button
                onClick={onClose}
                className="text-xs uppercase tracking-[0.25em] text-[var(--color-crowd)] hover:text-[var(--color-chalk)]"
              >
                close
              </button>
            </div>

            <Field label="Athlete name">
              <input
                value={settings.athleteName}
                onChange={(e) => update({ athleteName: e.target.value.slice(0, 24) })}
                placeholder="THE ATHLETE"
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5 font-display text-xl uppercase tracking-wider text-[var(--color-chalk)] placeholder-[var(--color-crowd)] outline-none focus:border-[var(--color-blaze)]"
              />
            </Field>

            <Field label="ElevenLabs API key">
              <input
                value={settings.elevenKey}
                onChange={(e) => { update({ elevenKey: e.target.value.trim() }); setKeyStatus("idle"); }}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk_****  — stored locally, never sent to our servers"
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5 font-mono text-sm text-[var(--color-chalk)] placeholder-[var(--color-crowd)] outline-none focus:border-[var(--color-blaze)]"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.2em]">
                <span className={
                  keyStatus === "ok" ? "text-[var(--color-volt)]" :
                  keyStatus === "bad" ? "text-[var(--color-blaze)]" :
                  keyStatus === "checking" ? "text-[var(--color-crowd)]" :
                  "text-[var(--color-crowd)]"
                }>
                  {keyStatus === "ok" ? "✓ verified" :
                   keyStatus === "bad" ? "✗ invalid key" :
                   keyStatus === "checking" ? "checking…" :
                   settings.elevenKey ? "unverified" : "no key — demo voice mode"}
                </span>
                <a
                  href="https://elevenlabs.io/app/settings/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-chalk)]/70 underline decoration-dotted"
                >
                  get key
                </a>
              </div>
            </Field>

            <Field label="Play-by-play voice">
              <select
                value={settings.voiceId}
                onChange={(e) => update({ voiceId: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5 font-mono text-sm text-[var(--color-chalk)] outline-none focus:border-[var(--color-blaze)]"
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
                onChange={(e) => update({ colorVoiceId: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5 font-mono text-sm text-[var(--color-chalk)] outline-none focus:border-[var(--color-blaze)]"
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] leading-snug text-[var(--color-crowd)]">
                Second voice. Interjects dry asides after play-by-play beats.
              </div>
            </Field>

            <Field label={`Hype level · ${settings.hypeLevel}`}>
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
                <span>chill</span><span>chaos</span>
              </div>
            </Field>

            <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] p-4 text-sm text-[var(--color-chalk)]/80">
              <div className="font-display text-lg tracking-wider text-[var(--color-chalk)]">HOW TO USE</div>
              <ol className="mt-2 space-y-1.5 list-decimal pl-5 text-[13px] leading-snug">
                <li>Paste an ElevenLabs key, or skip for demo voice.</li>
                <li>Put a phone in a pocket or chest holder. Earbuds in.</li>
                <li>Hit <span className="text-[var(--color-volt)] font-display">GO</span>. Start moving.</li>
                <li>Yell things into your collar mic — the broadcast reacts.</li>
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
      <div className="mb-1.5 font-display text-xs uppercase tracking-[0.25em] text-[var(--color-crowd)]">{label}</div>
      {children}
    </label>
  );
}
