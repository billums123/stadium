import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSettings } from "./lib/store";
import { useBroadcast } from "./hooks/useBroadcast";
import { haptic } from "./lib/haptics";
import { Scoreboard } from "./components/Scoreboard";
import { CaptionStream } from "./components/CaptionStream";
import { Ticker } from "./components/Ticker";
import { BroadcastButton } from "./components/BroadcastButton";
import { SettingsSheet } from "./components/SettingsSheet";
import { SessionLog } from "./components/SessionLog";
import { FlashOverlay } from "./components/FlashOverlay";
import { GoalPicker } from "./components/GoalPicker";
import { GoalHud } from "./components/GoalHud";
import { AthleteName } from "./components/AthleteName";
import { Confetti } from "./components/Confetti";

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

  // Confetti burst when the goal ticks over to complete.
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const prevGoalStatus = useRef<string | null>(null);
  useEffect(() => {
    const s = status.goalProgress?.status ?? null;
    if (prevGoalStatus.current !== "complete" && s === "complete") {
      setConfettiTrigger((n) => n + 1);
      haptic("success");
    }
    if (prevGoalStatus.current !== "failed" && s === "failed") {
      haptic("fail");
    }
    prevGoalStatus.current = s;
  }, [status.goalProgress?.status]);

  // Ambient haptic on urgency-3 lines (milestone / surge / goal-complete).
  const lastLineId = useRef<string | null>(null);
  useEffect(() => {
    if (!status.lastLine) return;
    const id = status.lastLine.text;
    if (id === lastLineId.current) return;
    lastLineId.current = id;
    if (status.lastLine.urgency === 3) haptic("ambient");
  }, [status.lastLine]);

  const micDot = useMemo(() => {
    if (status.interim) return "listening";
    if (status.transcript) return "heard";
    return "idle";
  }, [status.interim, status.transcript]);

  return (
    <div className="relative min-h-dvh bg-[var(--color-ink)] stadium-grain">
      <TopBar
        onOpenSettings={() => {
          haptic("tap");
          setSettingsOpen(true);
        }}
        phase={status.phase}
      />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 pb-28 pt-3 sm:gap-4 sm:px-4">
        {screen === "landing" ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4"
          >
            <Hero />
            <AthleteName
              value={settings.athleteName}
              onChange={(athleteName) => updateSettings({ athleteName })}
            />
            <GoalPicker
              goal={settings.goal}
              onChange={(goal) => {
                haptic("tap");
                updateSettings({ goal });
              }}
            />
            <Ticker />
            <div className="hidden sm:block">
              <Pillars />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-3"
          >
            <Scoreboard status={status} athleteName={settings.athleteName} />
            {status.goalProgress && <GoalHud progress={status.goalProgress} />}
            <CaptionStream line={status.lastLine} speaking={status.speaking} />
            <MicCard interim={status.interim} transcript={status.transcript} dot={micDot} />
            <SessionLog history={status.history} />
            {status.error && (
              <div className="rounded-lg border border-[var(--color-blaze)]/60 bg-[var(--color-blaze)]/10 px-3 py-2 text-sm text-[var(--color-chalk)]">
                ⚠ {status.error}
              </div>
            )}
          </motion.div>
        )}
      </main>

      <BottomBar
        phase={status.phase}
        onStart={() => {
          haptic("press");
          broadcast.start();
        }}
        onStop={() => {
          haptic("press");
          broadcast.stop();
        }}
        onSimulate={broadcast.simulate}
        onForceLine={() => {
          haptic("press");
          broadcast.forceLine();
        }}
      />

      <FlashOverlay line={status.lastLine} />
      <Confetti trigger={confettiTrigger} />

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
          className={`ml-2 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.25em] ${
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
        aria-label="Open settings"
        className="min-h-[44px] rounded-lg border border-[var(--color-line)] px-3.5 font-display text-sm uppercase tracking-[0.2em] text-[var(--color-chalk)]/85 active:scale-95 hover:border-[var(--color-chalk)]"
      >
        settings
      </button>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-gradient-to-b from-[var(--color-ink-2)] to-[var(--color-ink)] px-4 py-6 scanline sm:px-5 sm:py-8">
      <div className="absolute -top-10 right-2 font-display text-[10rem] leading-none text-[var(--color-chalk)]/[0.03]">
        STADIUM
      </div>
      <div className="relative">
        <p className="font-display text-[10px] uppercase tracking-[0.5em] text-[var(--color-blaze)]">
          Live AI Broadcast · Ch. 01
        </p>
        <h1 className="mt-2 font-display text-[clamp(2.5rem,13vw,5.5rem)] leading-[0.88] text-[var(--color-chalk)]">
          EVERY STEP.
          <br />
          <span className="text-[var(--color-blaze)]">THE MAIN</span>
          <br />
          EVENT.
        </h1>
        <p className="mt-3 max-w-sm text-[14px] leading-snug text-[var(--color-chalk)]/80 sm:text-[15px]">
          An AI sports broadcast for your walk, run, or ride. You move, a pro-grade AI commentator goes feral.
          Phone in a pocket, headphones in, GO.
        </p>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    {
      title: "AI PLAY-BY-PLAY",
      body: "A pro-grade AI commentator reacts to your pace, distance, and anything you shout into your collar mic.",
    },
    {
      title: "STADIUM CROWD",
      body: "A generative crowd bed keeps the roar under you the whole run — tunnels, hills, finish lines included.",
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
  onForceLine,
}: {
  phase: "idle" | "warming" | "live" | "stopping";
  onStart: () => void;
  onStop: () => void;
  onSimulate: (kmh: number) => void;
  onForceLine: () => void;
}) {
  const isLive = phase === "live";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-line)] bg-[var(--color-ink)]/92 px-3 pb-[max(env(safe-area-inset-bottom,0.5rem),0.5rem)] pt-2 backdrop-blur sm:px-4 sm:pt-3">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2">
        {isLive ? (
          <ActionButton label="WALK" sub="sim" onClick={() => onSimulate(5)} />
        ) : (
          <div className="w-[82px] sm:w-[92px]" />
        )}
        <BroadcastButton phase={phase} onStart={onStart} onStop={onStop} />
        {isLive ? (
          <ActionButton label="HYPE" sub="line" accent onClick={onForceLine} />
        ) : (
          <div className="w-[82px] sm:w-[92px]" />
        )}
      </div>
      {isLive && (
        <div className="mx-auto mt-1.5 flex w-full max-w-xl justify-center">
          <button
            onClick={() => onSimulate(11)}
            className="min-h-[40px] rounded-lg border border-[var(--color-line)] bg-[var(--color-ink-2)]/70 px-3.5 py-1.5 font-display text-[12px] uppercase tracking-[0.25em] text-[var(--color-chalk)]/80 active:scale-95 hover:border-[var(--color-chalk)]/60"
          >
            sim · run pace
          </button>
        </div>
      )}
    </nav>
  );
}

function ActionButton({
  label,
  sub,
  onClick,
  accent,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[64px] w-[82px] flex-col items-center justify-center rounded-lg border px-2 py-2 transition active:scale-95 sm:w-[92px] ${
        accent
          ? "border-[var(--color-volt)]/60 bg-[var(--color-volt)]/10 text-[var(--color-volt)] hover:border-[var(--color-volt)]"
          : "border-[var(--color-line)] bg-[var(--color-ink-2)]/80 text-[var(--color-chalk)] hover:border-[var(--color-chalk)]/60"
      }`}
    >
      <div className="font-display text-[11px] uppercase tracking-[0.25em] opacity-75">{sub}</div>
      <div className="font-display text-lg leading-none">{label}</div>
    </button>
  );
}

export default App;
