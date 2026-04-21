import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Settings } from "../lib/store";
import { listVoices, checkKey, type Voice, type KeyStatus } from "../lib/elevenlabs";
import { MODEL_OPTIONS } from "../lib/llm";
import { haptic } from "../lib/haptics";

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
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | KeyStatus>("idle");
  // Developer section: auto-expand only on first mount when neither key
  // is present, never again. Don't bounce open/close as state changes.
  const [devOpen, setDevOpen] = useState(
    () => !settings.elevenKey && !settings.openaiKey
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (!settings.elevenKey) return;
      setKeyStatus("checking");
      const status = await checkKey(settings.elevenKey);
      if (cancelled) return;
      setKeyStatus(status);
      if (status === "ok" || status === "scoped") {
        try {
          const v = await listVoices(settings.elevenKey);
          if (!cancelled && v.length) {
            const merged = [
              ...v.slice(0, 20),
              ...PRESET_VOICES.filter((p) => !v.find((x) => x.voice_id === p.voice_id)),
            ];
            setVoices(merged);
          }
        } catch {
          /* keep presets — scoped keys may not have voices_read */
        }
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

            <label className="mb-4 flex min-h-[60px] items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5">
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

            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setDevOpen((v) => !v);
              }}
              className="mt-2 flex w-full items-center justify-between rounded-lg border border-dashed border-[var(--color-line)] bg-transparent px-3 py-3 text-left transition hover:border-[var(--color-chalk)]/50"
              aria-expanded={devOpen}
            >
              <div>
                <div className="font-display text-[11px] uppercase tracking-[0.3em] text-[var(--color-crowd)]">
                  developer
                </div>
                <div className="text-[11px] leading-snug text-[var(--color-crowd)]">
                  {!settings.elevenKey && !settings.openaiKey
                    ? "no keys detected — paste your own to go live"
                    : "override API keys and model"}
                </div>
              </div>
              <div className="font-display text-lg leading-none text-[var(--color-crowd)]">
                {devOpen ? "−" : "+"}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {devOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4">
                    <Field label="ElevenLabs API key">
                      <input
                        value={settings.elevenKey}
                        onChange={(e) => {
                          update({ elevenKey: e.target.value.trim() });
                          setKeyStatus("idle");
                        }}
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="sk_****  — stored locally, never sent to our servers"
                        className="w-full min-h-[44px] rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 font-mono text-sm text-[var(--color-chalk)] placeholder-[var(--color-crowd)] outline-none focus:border-[var(--color-blaze)]"
                      />
                      <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.2em]">
                        <span
                          className={
                            keyStatus === "ok" || keyStatus === "scoped"
                              ? "text-[var(--color-volt)]"
                              : keyStatus === "invalid" || keyStatus === "network-error"
                              ? "text-[var(--color-blaze)]"
                              : "text-[var(--color-crowd)]"
                          }
                        >
                          {keyStatus === "ok"
                            ? "✓ verified"
                            : keyStatus === "scoped"
                            ? "✓ scoped · good to go"
                            : keyStatus === "invalid"
                            ? "✗ invalid"
                            : keyStatus === "network-error"
                            ? "network error"
                            : keyStatus === "checking"
                            ? "checking…"
                            : settings.elevenKey
                            ? "unverified"
                            : "no key — demo voice"}
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

                    <Field label="OpenAI API key">
                      <input
                        value={settings.openaiKey}
                        onChange={(e) => update({ openaiKey: e.target.value.trim() })}
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="sk-proj-****  — stored locally, never sent to our servers"
                        className="w-full min-h-[44px] rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-3 font-mono text-sm text-[var(--color-chalk)] placeholder-[var(--color-crowd)] outline-none focus:border-[var(--color-blaze)]"
                      />
                      <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.2em]">
                        <span className="text-[var(--color-crowd)]">
                          {settings.openaiKey
                            ? settings.useDynamic
                              ? "dynamic on"
                              : "saved · dynamic off"
                            : "no key — templates only"}
                        </span>
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-chalk)]/70 underline decoration-dotted"
                        >
                          get key
                        </a>
                      </div>
                    </Field>

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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
