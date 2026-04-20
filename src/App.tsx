import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "./lib/store";
import { useBroadcast } from "./hooks/useBroadcast";
import { Scoreboard } from "./components/Scoreboard";
import { CaptionStream } from "./components/CaptionStream";
import { Ticker } from "./components/Ticker";
import { BroadcastButton } from "./components/BroadcastButton";
import { SettingsSheet } from "./components/SettingsSheet";

function App() {
  const [settings, updateSettings] = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screen, setScreen] = useState<"landing" | "live">("landing");

  const broadcast = useBroadcast(settings);
  const { status } = broadcast;

  useEffect(() => {
    if (status.phase === "live" && screen === "landing") setScreen("live");
    if (status.phase === "idle" && screen === "live") setScreen("landing");
  }, [status.phase, screen]);

  const micDot = useMemo(() => {
    if (status.interim) return "listening";
    if (status.transcript) return "heard";
    return "idle";
  }, [status.interim, status.transcript]);

  return (
    <div className="relative min-h-dvh bg-[var(--color-ink)] stadium-grain">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} phase={status.phase} />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-28 pt-3">
        <AnimatePresence mode="wait">
          {screen === "landing" ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-4"
            >
              <Hero />
              <Ticker />
              <Pillars />
            </motion.div>
          ) : (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-4"
            >
              <Scoreboard status={status} athleteName={settings.athleteName} />
              <CaptionStream line={status.lastLine} speaking={status.speaking} />
              <MicCard interim={status.interim} transcript={status.transcript} dot={micDot} />
              {status.error && (
                <div className="rounded-lg border border-[var(--color-blaze)]/60 bg-[var(--color-blaze)]/10 px-3 py-2 text-sm text-[var(--color-chalk)]">
                  ⚠ {status.error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomBar
        phase={status.phase}
        onStart={broadcast.start}
        onStop={broadcast.stop}
        onSimulate={broadcast.simulate}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        update={updateSettings}
      />
    </div>
  );
}

function TopBar({
  onOpenSettings,
  phase,
}: {
  onOpenSettings: () => void;
  phase: "idle" | "warming" | "live" | "stopping";
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-ink)]/85 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-blaze)] font-display text-xl text-[var(--color-ink)]">
          S
        </div>
        <div className="font-display text-xl tracking-[0.2em] text-[var(--color-chalk)]">STADIUM</div>
        <div
          className={`ml-2 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.25em] ${
            phase === "live"
              ? "border-[var(--color-blaze)] text-[var(--color-blaze)]"
              : "border-[var(--color-line)] text-[var(--color-crowd)]"
          }`}
        >
          {phase === "live" ? "ON AIR" : phase === "warming" ? "WARMING" : "OFF AIR"}
        </div>
      </div>
      <button
        onClick={onOpenSettings}
        className="rounded-md border border-[var(--color-line)] px-3 py-1.5 font-display text-xs uppercase tracking-[0.2em] text-[var(--color-chalk)]/80 hover:border-[var(--color-chalk)]"
      >
        settings
      </button>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-gradient-to-b from-[var(--color-ink-2)] to-[var(--color-ink)] px-5 py-8 scanline">
      <div className="absolute -top-10 right-2 font-display text-[10rem] leading-none text-[var(--color-chalk)]/[0.03]">
        STADIUM
      </div>
      <div className="relative">
        <p className="font-display text-[10px] uppercase tracking-[0.5em] text-[var(--color-blaze)]">
          ElevenLabs × Kiro · Hackathon 04
        </p>
        <h1 className="mt-2 font-display text-[clamp(3rem,14vw,5.5rem)] leading-[0.88] text-[var(--color-chalk)]">
          EVERY STEP.
          <br />
          <span className="text-[var(--color-blaze)]">THE MAIN</span>
          <br />
          EVENT.
        </h1>
        <p className="mt-3 max-w-sm text-[15px] leading-snug text-[var(--color-chalk)]/80">
          An AI sports broadcast for your walk, run, or ride. You move, an ElevenLabs commentator goes feral.
          Crowd roars included. Film it. Post it. Win the hackathon.
        </p>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    {
      title: "AI PLAY-BY-PLAY",
      body: "ElevenLabs v2 TTS reacts to your pace, distance, and anything you shout into your collar mic.",
    },
    {
      title: "STADIUM CROWD",
      body: "A generative SFX bed from ElevenLabs Sound Effects keeps the roar under you the whole run.",
    },
    {
      title: "BROADCAST HUD",
      body: "A scoreboard built for the camera. Big numbers, bigger hype score, designed for vertical video.",
    },
  ];
  return (
    <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.title}
          className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/80 p-3"
        >
          <div className="font-display text-sm tracking-[0.2em] text-[var(--color-volt)]">
            {it.title}
          </div>
          <div className="mt-1 text-[13px] leading-snug text-[var(--color-chalk)]/80">
            {it.body}
          </div>
        </div>
      ))}
    </section>
  );
}

function MicCard({
  interim,
  transcript,
  dot,
}: {
  interim: string;
  transcript: string;
  dot: "idle" | "listening" | "heard";
}) {
  const dotColor =
    dot === "listening"
      ? "bg-[var(--color-volt)] animate-pulse"
      : dot === "heard"
      ? "bg-[var(--color-blaze)]"
      : "bg-[var(--color-line)]";
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)]/80 px-4 py-3">
      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[var(--color-crowd)]">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
        your mic · {dot}
      </div>
      <div className="font-mono text-sm text-[var(--color-chalk)]/90 min-h-[1.5rem] break-words">
        {interim || transcript || <span className="text-[var(--color-crowd)]">Say anything — the broadcast hears you.</span>}
      </div>
    </div>
  );
}

function BottomBar({
  phase,
  onStart,
  onStop,
  onSimulate,
}: {
  phase: "idle" | "warming" | "live" | "stopping";
  onStart: () => void;
  onStop: () => void;
  onSimulate: (kmh: number) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-line)] bg-[var(--color-ink)]/90 px-4 py-3 backdrop-blur pb-[max(env(safe-area-inset-bottom,0.75rem),0.75rem)]">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3">
        <SimulateButton label="WALK" kmh={5} onSimulate={onSimulate} disabled={phase !== "live"} />
        <BroadcastButton phase={phase} onStart={onStart} onStop={onStop} />
        <SimulateButton label="RUN" kmh={11} onSimulate={onSimulate} disabled={phase !== "live"} />
      </div>
    </nav>
  );
}

function SimulateButton({
  label,
  kmh,
  onSimulate,
  disabled,
}: {
  label: string;
  kmh: number;
  onSimulate: (kmh: number) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onSimulate(kmh)}
      disabled={disabled}
      className="flex flex-col items-center rounded-lg border border-[var(--color-line)] bg-[var(--color-ink-2)]/80 px-3 py-2 text-left transition enabled:hover:border-[var(--color-chalk)]/60 disabled:opacity-40"
    >
      <div className="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-crowd)]">sim</div>
      <div className="font-display text-base leading-none text-[var(--color-chalk)]">{label}</div>
    </button>
  );
}

export default App;
