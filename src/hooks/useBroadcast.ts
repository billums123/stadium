import { useCallback, useEffect, useRef, useState } from "react";
import { createMotionTracker, type MotionState } from "../lib/motion";
import type { Line, Voice } from "../lib/commentary";
import { synthesizeSpeech } from "../lib/elevenlabs";
import { loadCrowdBed, loadMusicBed, fadeTo, musicVolumeFor } from "../lib/ambient";
import { acquireWakeLock, type WakeLockHandle } from "../lib/wakelock";
import { loadCareer, recordSession, saveCareer, type Career } from "../lib/career";
import {
  plan,
  INITIAL_DIRECTOR,
  buildRecapPrompts,
  type DirectorState,
  type DirectorPlan,
} from "../lib/director";
import { buildRecapLine } from "../lib/commentary";
import { computeRecap, isRecapWorthy, type RecapSnapshot } from "../lib/recap";
import { generateLine, warmUp as warmUpLLM } from "../lib/llm";
import { stripAudioTags } from "../lib/tags";
import { computeProgress, type GoalProgress } from "../lib/goal";
import { countdownBeep, startingHorn, primeAudio } from "../lib/soundfx";
import type { Settings } from "../lib/store";

export type BroadcastPhase = "idle" | "warming" | "live" | "stopping" | "recap";

export type BroadcastStatus = {
  phase: BroadcastPhase;
  motion: MotionState;
  lastLine: Line | null;
  history: Line[];
  speaking: boolean;
  hypeScore: number; // 0-100 intensity derived from director/pace/goal
  error: string | null;
  career: Career;
  goalProgress: GoalProgress | null;
  dynamicActive: boolean;
  /** null when not in cold-open. 3/2/1 during countdown. 0 on the horn. */
  countdown: number | null;
  /** Populated when phase === "recap". Null otherwise. */
  recap: RecapSnapshot | null;
};

const EMPTY_MOTION: MotionState = {
  distanceMeters: 0,
  elapsedMs: 0,
  paceKmh: 0,
  steps: 0,
  movementIntensity: 0,
  lat: null,
  lon: null,
  sourceGeo: false,
  sourceMotion: false,
};

export function useBroadcast(settings: Settings) {
  const [status, setStatus] = useState<BroadcastStatus>(() => ({
    phase: "idle",
    motion: EMPTY_MOTION,
    lastLine: null,
    history: [],
    speaking: false,
    hypeScore: 0,
    error: null,
    career: loadCareer(),
    goalProgress: null,
    dynamicActive: false,
    countdown: null,
    recap: null,
  }));

  const directorRef = useRef<DirectorState>({ ...INITIAL_DIRECTOR });
  const sessionStartRef = useRef(0);
  const peakKmhRef = useRef(0);
  const peakHypeRef = useRef(0);
  const careerRef = useRef<Career>(status.career);
  const lastLineRef = useRef<Line | null>(null);
  const lastIntensityRef = useRef(0);
  const trackerRef = useRef<ReturnType<typeof createMotionTracker> | null>(null);
  const crowdAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const tickRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const motionRef = useRef<MotionState>(EMPTY_MOTION);

  const setPartial = useCallback((patch: Partial<BroadcastStatus>) => {
    setStatus((s) => ({ ...s, ...patch }));
  }, []);

  const voiceIdFor = useCallback(
    (v: Voice) => (v === "color" && settings.colorVoiceId ? settings.colorVoiceId : settings.voiceId),
    [settings.voiceId, settings.colorVoiceId]
  );

  /**
   * Turn a director plan into audible commentary.
   * - Dynamic mode: asks the LLM for a fresh line, falls back to the
   *   plan's template if the call returns null.
   * - Delivery: ElevenLabs voice settings + audio playback rate both
   *   scale with the plan's intensity.
   */
  const speakPlan = useCallback(
    async (p: DirectorPlan) => {
      if (speakingRef.current) return;
      speakingRef.current = true;
      lastIntensityRef.current = p.intensity;

      let text = p.fallbackLine.text;
      let usedDynamic = false;

      if (settings.useDynamic && p.prompts) {
        const generated = await generateLine({
          system: p.prompts.system,
          user: p.prompts.user,
          model: settings.llmModel,
          maxTokens: 180,
          timeoutMs: 4000,
        });
        if (generated) {
          text = generated;
          usedDynamic = true;
        }
      }

      const line: Line = {
        trigger: p.fallbackLine.trigger,
        voice: p.voice,
        urgency: p.urgency,
        text,
      };
      lastLineRef.current = line;
      if (p.intensity > peakHypeRef.current) peakHypeRef.current = p.intensity;
      setStatus((s) => ({
        ...s,
        lastLine: line,
        speaking: true,
        history: [line, ...s.history].slice(0, 6),
        hypeScore: p.intensity,
        dynamicActive: usedDynamic,
      }));

      // Keep [audio-tag] cues in the display text but strip them before
      // TTS: v3 would understand them, turbo_v2_5 reads them literally.
      // Duck the ambient beds hard during speech so the commentary sits
      // cleanly on top and — more importantly — so the phone's own
      // speaker doesn't feed back through the mic.
      duckBeds(crowdAudioRef.current, musicAudioRef.current, true);
      try {
        try {
          const hype = p.intensity / 100;
          const spokenText = stripAudioTags(text);
          const blob = await synthesizeSpeech({
            voiceId: voiceIdFor(p.voice),
            text: spokenText,
            style:
              p.voice === "color"
                ? Math.min(0.55, 0.25 + hype * 0.2)
                : Math.min(0.98, 0.45 + hype * 0.55),
            stability:
              p.voice === "color"
                ? Math.max(0.35, 0.6 - hype * 0.2)
                : Math.max(0.12, 0.55 - hype * 0.4),
            similarity: 0.85,
          });
          const url = URL.createObjectURL(blob);
          await playUrlAtRate(url, speechAudioRef, rateForIntensity(p.intensity, p.voice));
          URL.revokeObjectURL(url);
          setPartial({ error: null });
        } catch (err) {
          setPartial({ error: (err as Error).message });
          if ("speechSynthesis" in window) await browserSpeak(stripAudioTags(text), p.intensity);
        }
      } finally {
        speakingRef.current = false;
        setPartial({ speaking: false });
        duckBeds(crowdAudioRef.current, musicAudioRef.current, false);
      }
    },
    [
      settings.useDynamic,
      settings.llmModel,
      setPartial,
      voiceIdFor,
    ]
  );

  const start = useCallback(async () => {
    setPartial({ phase: "warming", error: null, countdown: null });
    // Skip the director's own cold-open script — we're running a real
    // theatrical opening (welcome TTS + 3-2-1 countdown + horn) below.
    directorRef.current = { ...INITIAL_DIRECTOR, coldOpenIndex: -1, hasOpened: true };
    lastLineRef.current = null;
    peakKmhRef.current = 0;
    peakHypeRef.current = 0;

    wakeLockRef.current = await acquireWakeLock();

    // Prime the LLM connection in the background so the first real
    // commentary line doesn't pay the cold-start latency.
    if (settings.useDynamic) warmUpLLM(settings.llmModel);

    // Kick Web Audio alive inside the user gesture so the countdown
    // beeps + horn can play on iOS without being autoplay-blocked.
    primeAudio();

    try {
      crowdAudioRef.current = await loadCrowdBed();
      crowdAudioRef.current.play().catch(() => { /* autoplay blocked */ });
    } catch (e) { void e; }

    void (async () => {
      const music = await loadMusicBed();
      if (!music) return;
      musicAudioRef.current = music;
      try {
        await music.play();
        fadeTo(music, 0.18, 2500);
      } catch { /* autoplay blocked */ }
    })();

    // ─── 1. Welcome line ────────────────────────────────────────────
    const athlete = settings.athleteName || "THE ATHLETE";
    await speakWelcome(athlete, settings, careerRef.current);

    // ─── 2. Visual 3-2-1 countdown with a beep per tick ─────────────
    for (const n of [3, 2, 1] as const) {
      setPartial({ countdown: n });
      countdownBeep(false);
      await wait(1000);
    }

    // ─── 3. Horn + "GO!" flash ──────────────────────────────────────
    setPartial({ countdown: 0 });
    countdownBeep(true);
    void startingHorn();
    await wait(900);
    setPartial({ countdown: null });

    // ─── 4. NOW start the session clock + motion + reactive engine ──
    sessionStartRef.current = performance.now();

    const tracker = createMotionTracker((m) => {
      motionRef.current = m;
      if (m.paceKmh > peakKmhRef.current) peakKmhRef.current = m.paceKmh;
      const progress = settings.goal
        ? computeProgress(settings.goal, m.elapsedMs, m.distanceMeters)
        : null;
      setPartial({ motion: m, goalProgress: progress });

      // Gentle duck of the crowd bed by intensity; actual hard-duck
      // during TTS is handled by duckBeds() in speakPlan.
      if (crowdAudioRef.current && !speakingRef.current) {
        const target = lastIntensityRef.current > 70 ? 0.32 : 0.22;
        if (Math.abs(crowdAudioRef.current.volume - target) > 0.04) {
          fadeTo(crowdAudioRef.current, target, 600);
        }
      }

      // Pump-up music swell: rise toward goal-wire (or on a free-run
      // surge), fade back when things cool. Skip while TTS is
      // speaking — duckBeds handles that.
      if (musicAudioRef.current && !speakingRef.current) {
        const target = musicVolumeFor(progress?.distancePct ?? null, lastIntensityRef.current);
        if (Math.abs(musicAudioRef.current.volume - target) > 0.015) {
          fadeTo(musicAudioRef.current, target, 900);
        }
      }
    });
    trackerRef.current = tracker;
    await tracker.start();


    tickRef.current = window.setInterval(() => {
      const elapsed = performance.now() - sessionStartRef.current;
      const result = plan(
        directorRef.current,
        {
          athleteName: settings.athleteName || "THE ATHLETE",
          motion: motionRef.current,
          lastTranscript: null,
          lastTranscriptAgeMs: Number.POSITIVE_INFINITY,
          elapsedInSessionMs: elapsed,
          hypeFloor: settings.hypeLevel,
          career: careerRef.current,
          goal: settings.goal,
          units: settings.units,
        },
        lastLineRef.current
      );

      if (result) {
        directorRef.current = result.next;
        void speakPlan(result);
      }
    }, 1200);

    setPartial({ phase: "live" });
  }, [
    settings,
    setPartial,
    speakPlan,
  ]);

  const stop = useCallback(async () => {
    setPartial({ phase: "stopping", countdown: null });
    if (tickRef.current != null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    trackerRef.current?.stop();

    // Snapshot the frozen session state before we tear audio down.
    const frozenMotion = { ...motionRef.current };
    const frozenGoalProgress = settings.goal
      ? computeProgress(settings.goal, frozenMotion.elapsedMs, frozenMotion.distanceMeters)
      : null;
    const worthRecap = isRecapWorthy(frozenMotion);

    if (crowdAudioRef.current) {
      // Fade crowd out cleanly; keep the element alive briefly so the
      // recap screen has some ambient room tone under it.
      fadeTo(crowdAudioRef.current, 0.08, 400);
      const c = crowdAudioRef.current;
      crowdAudioRef.current = null;
      setTimeout(() => {
        if (!worthRecap) c.pause();
      }, 500);
      if (worthRecap) {
        // Let the recap screen pause it on dismount.
        setTimeout(() => c.pause(), 30_000);
      }
    }
    if (musicAudioRef.current) {
      const m = musicAudioRef.current;
      fadeTo(m, 0, 500);
      setTimeout(() => m.pause(), 550);
      musicAudioRef.current = null;
    }
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
    }
    if (wakeLockRef.current) {
      void wakeLockRef.current.release();
      wakeLockRef.current = null;
    }

    // Sub-threshold sessions go straight back to landing without a
    // recap, and don't pollute career stats. R1 thresholds.
    if (!worthRecap) {
      setPartial({ phase: "idle", goalProgress: null, recap: null });
      return;
    }

    // Persist the session into career (R12 — exactly once, on recap entry).
    const sessionKm = frozenMotion.distanceMeters / 1000;
    const nextCareer = recordSession(careerRef.current, sessionKm, peakKmhRef.current);
    careerRef.current = nextCareer;
    saveCareer(nextCareer);

    // Build the recap snapshot (R4–R6).
    const recap = computeRecap(
      settings.athleteName || "THE ATHLETE",
      frozenMotion,
      peakKmhRef.current,
      peakHypeRef.current,
      frozenGoalProgress
    );

    // Render the recap immediately with a placeholder line, then
    // backfill the closing beat when the LLM resolves.
    setStatus((s) => ({
      ...s,
      phase: "recap",
      goalProgress: frozenGoalProgress,
      career: nextCareer,
      recap,
    }));

    // Generate the closing line (R7–R9).
    const outcomeKind: "complete" | "failed" | "free-run" =
      recap.goalOutcome === "complete" ? "complete"
      : recap.goalOutcome === "failed" ? "failed"
      : "free-run";
    const fallbackLine = buildRecapLine(outcomeKind, {
      athleteName: recap.athleteName,
      motion: frozenMotion,
      lastTranscript: null,
      lastTranscriptAgeMs: Number.POSITIVE_INFINITY,
      elapsedInSessionMs: frozenMotion.elapsedMs,
      hypeLevel: settings.hypeLevel,
      career: nextCareer,
      units: settings.units,
    });

    let closingText = fallbackLine.text;
    if (settings.useDynamic) {
      const prompts = buildRecapPrompts({
        athleteName: recap.athleteName,
        outcome: recap.goalOutcome,
        totalDistanceM: recap.totalDistanceM,
        totalTimeMs: recap.totalTimeMs,
        peakKmh: recap.peakKmh,
        avgKmh: recap.avgKmh,
        peakHype: recap.peakHype,
        careerAfterSessions: nextCareer.sessions,
        careerAfterTotalKm: nextCareer.totalKm,
        units: settings.units,
      });
      const generated = await generateLine({
        system: prompts.system,
        user: prompts.user,
        model: settings.llmModel,
        maxTokens: 160,
        timeoutMs: 4000,
      });
      if (generated) closingText = generated;
    }

    const closingLine: Line = {
      ...fallbackLine,
      text: closingText,
    };

    setStatus((s) => (s.recap
      ? { ...s, recap: { ...s.recap, closingLine } }
      : s
    ));

    // Speak the closing line through the normal TTS pipeline.
    try {
      const blob = await synthesizeSpeech({
        voiceId: settings.voiceId,
        text: stripAudioTags(closingText),
        style: recap.goalOutcome === "complete" ? 0.85 : 0.55,
        stability: 0.4,
        similarity: 0.85,
      });
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
        speechAudioRef.current = audio;
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } catch {
      /* silent — text is already on screen */
    }
  }, [settings, setPartial]);

  const newBroadcast = useCallback(() => {
    if (speechAudioRef.current) speechAudioRef.current.pause();
    setStatus((s) => ({
      ...s,
      phase: "idle",
      goalProgress: null,
      recap: null,
      lastLine: null,
      history: [],
      hypeScore: 0,
      countdown: null,
      error: null,
    }));
    directorRef.current = { ...INITIAL_DIRECTOR };
    lastLineRef.current = null;
  }, []);

  const simulate = useCallback((kmh: number) => {
    trackerRef.current?.simulate(kmh);
  }, []);

  const forceLine = useCallback(() => {
    if (speakingRef.current) return;
    const elapsed = performance.now() - sessionStartRef.current;
    const state = { ...directorRef.current, lastTriggerAt: -999_999 };
    const result = plan(
      state,
      {
        athleteName: settings.athleteName || "THE ATHLETE",
        motion: motionRef.current,
        lastTranscript: null,
        lastTranscriptAgeMs: Number.POSITIVE_INFINITY,
        elapsedInSessionMs: elapsed,
        hypeFloor: settings.hypeLevel,
        career: careerRef.current,
        goal: settings.goal,
        units: settings.units,
      },
      lastLineRef.current
    );
    if (result) {
      directorRef.current = result.next;
      void speakPlan(result);
    }
  }, [settings.athleteName, settings.hypeLevel, settings.goal, speakPlan]);

  useEffect(() => () => {
    if (tickRef.current != null) clearInterval(tickRef.current);
    trackerRef.current?.stop();
    crowdAudioRef.current?.pause();
    musicAudioRef.current?.pause();
    void wakeLockRef.current?.release();
  }, []);

  return { status, start, stop, simulate, forceLine, newBroadcast };
}

/**
 * Map 0..100 intensity into a speech playback rate.
 * Play-by-play goes harder — up to 1.3x at peak.
 * Color voice tops out at 1.12x so it stays measured even when hot.
 */
/**
 * Intensity → playback rate. Cap narrower than before (up to 1.22x)
 * because at 1.3x even pitch-preserving time-stretch can sound smeared.
 */
function rateForIntensity(intensity: number, voice: Voice): number {
  const n = Math.max(0, Math.min(100, intensity)) / 100;
  if (voice === "color") return 0.98 + n * 0.12;
  return 0.99 + n * 0.22;
}

type WithPitchFlags = HTMLAudioElement & {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

function playUrlAtRate(
  url: string,
  audioRef: React.RefObject<HTMLAudioElement | null>,
  rate: number
): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url) as WithPitchFlags;
    // Preserve pitch while speeding up — otherwise the voice goes
    // chipmunky at any playbackRate > 1, which the user reads as
    // "robotic". All three property names cover older Safari/Firefox.
    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.webkitPreservesPitch = true;
    audio.playbackRate = rate;
    audioRef.current = audio;
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

/**
 * Crossfade the crowd / music beds down (during TTS) or back up
 * (after). Keeping them quieter during speech means the phone's own
 * speaker doesn't push enough volume to feed back through the mic.
 */
function duckBeds(
  crowd: HTMLAudioElement | null,
  music: HTMLAudioElement | null,
  ducked: boolean
) {
  if (crowd) fadeTo(crowd, ducked ? 0.08 : 0.22, 180);
  if (music) fadeTo(music, ducked ? 0.05 : 0.18, 180);
}

function browserSpeak(text: string, intensity: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95 + (Math.max(0, Math.min(100, intensity)) / 100) * 0.4;
      utter.pitch = 0.95;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Theatrical welcome line spoken before the 3-2-1 countdown. Tries the
 * LLM with a focused cold-open prompt; falls back to a template that
 * still sounds like a broadcaster when the call fails.
 */
async function speakWelcome(
  athleteName: string,
  settings: Settings,
  career: Career
): Promise<void> {
  const careerTag =
    career.sessions === 0
      ? "their debut broadcast — no prior entries on record"
      : `broadcast number ${career.sessions + 1}, ${career.totalKm.toFixed(1)} kilometres lifetime`;

  const hour = new Date().getHours();
  const slot =
    hour < 6  ? "the pre-dawn slot" :
    hour < 11 ? "the morning show" :
    hour < 14 ? "the midday broadcast" :
    hour < 18 ? "the afternoon card" :
    hour < 22 ? "primetime" :
                "the late-night edition";

  const fallback = `Good evening, good morning, good afternoon — welcome to STADIUM. You are tuned in to ${slot}. Tonight's main event: ${athleteName}. Stand by.`;

  let text = fallback;
  if (settings.useDynamic) {
    const generated = await generateLine({
      system: `You are the voice of STADIUM — a live AI sports broadcast. Write ONE cold-open welcome line, exactly the kind of line a professional sports broadcaster reads at the top of the show. TWO to THREE short sentences. Under 40 words total. Warm, confident, slightly theatrical. British-inflected. Must greet the audience, identify STADIUM by name, reference the time-of-day slot, and name the athlete. DO NOT count down, DO NOT mention numbers, DO NOT say "in three" / "in ten" / anything implying a countdown — a visual countdown handles that on its own immediately after you speak. End on a short anticipatory beat like "Stand by." or "Here we go." No audio tags. No hedging.`,
      user: `Athlete: ${athleteName}\nTime-of-day slot: ${slot}\nCareer: ${careerTag}\n\nWrite the cold-open welcome line now.`,
      model: settings.llmModel,
      maxTokens: 120,
      timeoutMs: 3500,
    });
    if (generated) text = generated;
  }

  const voiceId = settings.voiceId;
  try {
    const blob = await synthesizeSpeech({
      voiceId,
      text: stripAudioTags(text),
      style: 0.7,
      stability: 0.4,
      similarity: 0.85,
    });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
    URL.revokeObjectURL(url);
  } catch {
    // Network/auth failure — use browser TTS so the theatre still plays.
    await new Promise<void>((resolve) => {
      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        speechSynthesis.speak(utter);
      } catch {
        resolve();
      }
    });
  }
}
