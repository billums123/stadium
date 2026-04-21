import { useCallback, useEffect, useRef, useState } from "react";
import { createMotionTracker, type MotionState } from "../lib/motion";
import { startSpeechListener } from "../lib/speech";
import type { Line, Voice } from "../lib/commentary";
import { synthesizeSpeech, blobToObjectUrl } from "../lib/elevenlabs";
import { loadCrowdBed, loadMusicBed, fadeTo } from "../lib/ambient";
import { acquireWakeLock, type WakeLockHandle } from "../lib/wakelock";
import { loadCareer, recordSession, saveCareer, type Career } from "../lib/career";
import { plan, INITIAL_DIRECTOR, type DirectorState, type DirectorPlan } from "../lib/director";
import { generateLine, warmUp as warmUpLLM } from "../lib/llm";
import { computeProgress, type GoalProgress } from "../lib/goal";
import type { Settings } from "../lib/store";

export type BroadcastPhase = "idle" | "warming" | "live" | "stopping";

export type BroadcastStatus = {
  phase: BroadcastPhase;
  motion: MotionState;
  lastLine: Line | null;
  history: Line[];
  transcript: string;
  interim: string;
  speaking: boolean;
  hypeScore: number; // 0-100 intensity derived from director/pace/goal
  error: string | null;
  career: Career;
  goalProgress: GoalProgress | null;
  dynamicActive: boolean; // true when the last line came from the LLM, false = template fallback
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
    transcript: "",
    interim: "",
    speaking: false,
    hypeScore: 0,
    error: null,
    career: loadCareer(),
    goalProgress: null,
    dynamicActive: false,
  }));

  const directorRef = useRef<DirectorState>({ ...INITIAL_DIRECTOR });
  const sessionStartRef = useRef(0);
  const peakKmhRef = useRef(0);
  const careerRef = useRef<Career>(status.career);
  const lastLineRef = useRef<Line | null>(null);
  const lastIntensityRef = useRef(0);
  const trackerRef = useRef<ReturnType<typeof createMotionTracker> | null>(null);
  const speechRef = useRef<ReturnType<typeof startSpeechListener> | null>(null);
  const lastTranscriptAtRef = useRef<number>(-999999);
  const crowdAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const tickRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const motionRef = useRef<MotionState>(EMPTY_MOTION);
  const transcriptRef = useRef<string>("");

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

      if (settings.useDynamic && settings.openaiKey && p.prompts) {
        const generated = await generateLine({
          apiKey: settings.openaiKey,
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
      setStatus((s) => ({
        ...s,
        lastLine: line,
        speaking: true,
        history: [line, ...s.history].slice(0, 6),
        hypeScore: p.intensity,
        dynamicActive: usedDynamic,
      }));

      // Strip any audio tags out of the display text? We keep them — v3
      // TTS treats them as directions rather than reading them aloud, and
      // on turbo_v2_5 they're just parenthetical styling that reads fine.
      try {
        if (settings.elevenKey) {
          try {
            const hype = p.intensity / 100;
            const blob = await synthesizeSpeech({
              apiKey: settings.elevenKey,
              voiceId: voiceIdFor(p.voice),
              text,
              // Style pushes expressiveness. Color voice stays drier.
              style:
                p.voice === "color"
                  ? Math.min(0.55, 0.25 + hype * 0.2)
                  : Math.min(0.98, 0.45 + hype * 0.55),
              // Stability goes DOWN as hype goes UP (more dramatic variance).
              stability:
                p.voice === "color"
                  ? Math.max(0.35, 0.6 - hype * 0.2)
                  : Math.max(0.12, 0.55 - hype * 0.4),
              similarity: 0.85,
            });
            const url = blobToObjectUrl(blob);
            await playUrlAtRate(url, speechAudioRef, rateForIntensity(p.intensity, p.voice));
            URL.revokeObjectURL(url);
            setPartial({ error: null });
          } catch (err) {
            setPartial({ error: (err as Error).message });
            if ("speechSynthesis" in window) await browserSpeak(text, p.intensity);
          }
        } else if ("speechSynthesis" in window) {
          await browserSpeak(text, p.intensity);
        }
      } finally {
        speakingRef.current = false;
        setPartial({ speaking: false });
      }
    },
    [
      settings.elevenKey,
      settings.openaiKey,
      settings.useDynamic,
      settings.llmModel,
      setPartial,
      voiceIdFor,
    ]
  );

  const start = useCallback(async () => {
    setPartial({ phase: "warming", error: null });
    directorRef.current = { ...INITIAL_DIRECTOR };
    lastLineRef.current = null;
    peakKmhRef.current = 0;
    sessionStartRef.current = performance.now();

    wakeLockRef.current = await acquireWakeLock();

    // Prime the LLM connection in the background so the first real
    // commentary line doesn't pay the cold-start latency.
    if (settings.useDynamic && settings.openaiKey) {
      warmUpLLM(settings.openaiKey, settings.llmModel);
    }

    try {
      crowdAudioRef.current = await loadCrowdBed(settings.elevenKey || null);
      crowdAudioRef.current.play().catch(() => { /* autoplay blocked */ });
    } catch (e) { void e; }

    if (settings.elevenKey) {
      void (async () => {
        const music = await loadMusicBed(settings.elevenKey);
        if (!music) return;
        musicAudioRef.current = music;
        try {
          await music.play();
          fadeTo(music, 0.18, 2500);
        } catch { /* autoplay blocked */ }
      })();
    }

    const tracker = createMotionTracker((m) => {
      motionRef.current = m;
      if (m.paceKmh > peakKmhRef.current) peakKmhRef.current = m.paceKmh;
      const progress = settings.goal
        ? computeProgress(settings.goal, m.elapsedMs, m.distanceMeters)
        : null;
      setPartial({ motion: m, goalProgress: progress });

      // Duck crowd bed up on urgency-3 moments (wire in speak path).
      if (crowdAudioRef.current) {
        const target = lastIntensityRef.current > 70 ? 0.34 : 0.22;
        if (Math.abs(crowdAudioRef.current.volume - target) > 0.04) {
          fadeTo(crowdAudioRef.current, target, 600);
        }
      }
    });
    trackerRef.current = tracker;
    await tracker.start();

    const speech = startSpeechListener((text, isFinal) => {
      if (isFinal) {
        transcriptRef.current = text;
        lastTranscriptAtRef.current = performance.now();
        setPartial({ transcript: text, interim: "" });
      } else {
        setPartial({ interim: text });
      }
    });
    speechRef.current = speech;

    tickRef.current = window.setInterval(() => {
      const elapsed = performance.now() - sessionStartRef.current;
      const lastTranscriptAgeMs = performance.now() - lastTranscriptAtRef.current;
      const result = plan(
        directorRef.current,
        {
          athleteName: settings.athleteName || "THE ATHLETE",
          motion: motionRef.current,
          lastTranscript: transcriptRef.current || null,
          lastTranscriptAgeMs,
          elapsedInSessionMs: elapsed,
          hypeFloor: settings.hypeLevel,
          career: careerRef.current,
          goal: settings.goal,
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
    settings.athleteName,
    settings.elevenKey,
    settings.hypeLevel,
    settings.goal,
    setPartial,
    speakPlan,
  ]);

  const stop = useCallback(async () => {
    setPartial({ phase: "stopping" });
    if (tickRef.current != null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    trackerRef.current?.stop();
    speechRef.current?.stop();
    if (crowdAudioRef.current) {
      crowdAudioRef.current.pause();
      crowdAudioRef.current = null;
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

    const sessionKm = motionRef.current.distanceMeters / 1000;
    if (sessionKm > 0.02 || peakKmhRef.current > 2) {
      const next = recordSession(careerRef.current, sessionKm, peakKmhRef.current);
      careerRef.current = next;
      setPartial({ career: next });
      saveCareer(next);
    }

    setPartial({ phase: "idle", interim: "", goalProgress: null });
  }, [setPartial]);

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
        lastTranscript: transcriptRef.current || null,
        lastTranscriptAgeMs: performance.now() - lastTranscriptAtRef.current,
        elapsedInSessionMs: elapsed,
        hypeFloor: settings.hypeLevel,
        career: careerRef.current,
        goal: settings.goal,
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
    speechRef.current?.stop();
    crowdAudioRef.current?.pause();
    musicAudioRef.current?.pause();
    void wakeLockRef.current?.release();
  }, []);

  return { status, start, stop, simulate, forceLine };
}

/**
 * Map 0..100 intensity into a speech playback rate.
 * Play-by-play goes harder — up to 1.3x at peak.
 * Color voice tops out at 1.12x so it stays measured even when hot.
 */
function rateForIntensity(intensity: number, voice: Voice): number {
  const n = Math.max(0, Math.min(100, intensity)) / 100;
  if (voice === "color") return 0.97 + n * 0.15;
  return 0.98 + n * 0.32;
}

function playUrlAtRate(
  url: string,
  audioRef: React.RefObject<HTMLAudioElement | null>,
  rate: number
): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.playbackRate = rate;
    audio.preservesPitch = false;
    audioRef.current = audio;
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
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
