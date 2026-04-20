import { useCallback, useEffect, useRef, useState } from "react";
import { createMotionTracker, type MotionState } from "../lib/motion";
import { startSpeechListener } from "../lib/speech";
import { decide, INITIAL_ENGINE, type Line } from "../lib/commentary";
import { synthesizeSpeech, blobToObjectUrl } from "../lib/elevenlabs";
import { loadCrowdBed } from "../lib/ambient";
import type { Settings } from "../lib/store";

export type BroadcastPhase = "idle" | "warming" | "live" | "stopping";

export type BroadcastStatus = {
  phase: BroadcastPhase;
  motion: MotionState;
  lastLine: Line | null;
  transcript: string;
  interim: string;
  speaking: boolean;
  hypeScore: number; // 0-100, for the scoreboard HUD
  error: string | null;
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
  const [status, setStatus] = useState<BroadcastStatus>({
    phase: "idle",
    motion: EMPTY_MOTION,
    lastLine: null,
    transcript: "",
    interim: "",
    speaking: false,
    hypeScore: 0,
    error: null,
  });

  const engineRef = useRef({ ...INITIAL_ENGINE });
  const sessionStartRef = useRef(0);
  const trackerRef = useRef<ReturnType<typeof createMotionTracker> | null>(null);
  const speechRef = useRef<ReturnType<typeof startSpeechListener> | null>(null);
  const lastTranscriptAtRef = useRef<number>(-999999);
  const crowdAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const motionRef = useRef<MotionState>(EMPTY_MOTION);
  const transcriptRef = useRef<string>("");

  const setPartial = useCallback((patch: Partial<BroadcastStatus>) => {
    setStatus((s) => ({ ...s, ...patch }));
  }, []);

  const speakLine = useCallback(
    async (line: Line) => {
      if (speakingRef.current) return;
      speakingRef.current = true;
      setPartial({ lastLine: line, speaking: true });

      try {
        if (settings.elevenKey) {
          const blob = await synthesizeSpeech({
            apiKey: settings.elevenKey,
            voiceId: settings.voiceId,
            text: line.text,
            style: Math.min(0.95, 0.55 + (settings.hypeLevel - 3) * 0.1),
            stability: Math.max(0.15, 0.45 - (settings.hypeLevel - 3) * 0.05),
          });
          const url = blobToObjectUrl(blob);
          await playUrl(url, speechAudioRef);
          URL.revokeObjectURL(url);
        } else if ("speechSynthesis" in window) {
          await browserSpeak(line.text);
        }
      } catch (err) {
        setPartial({ error: (err as Error).message });
      } finally {
        speakingRef.current = false;
        setPartial({ speaking: false });
      }
    },
    [settings.elevenKey, settings.voiceId, settings.hypeLevel, setPartial]
  );

  const start = useCallback(async () => {
    setPartial({ phase: "warming", error: null });
    engineRef.current = { ...INITIAL_ENGINE };
    sessionStartRef.current = performance.now();

    try {
      crowdAudioRef.current = await loadCrowdBed(settings.elevenKey || null);
      try { await crowdAudioRef.current.play(); } catch { /* gesture required */ }
    } catch { /* skip crowd bed */ }

    const tracker = createMotionTracker((m) => {
      motionRef.current = m;
      setPartial({ motion: m });
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
      const result = decide(engineRef.current, {
        athleteName: settings.athleteName || "THE ATHLETE",
        motion: motionRef.current,
        lastTranscript: transcriptRef.current || null,
        lastTranscriptAgeMs,
        elapsedInSessionMs: elapsed,
        hypeLevel: settings.hypeLevel,
      });
      if (result) {
        engineRef.current = result.next;
        setPartial({
          hypeScore: Math.min(
            100,
            Math.round(
              motionRef.current.paceKmh * 4 +
                motionRef.current.movementIntensity * 30 +
                Math.min(40, elapsed / 60000 * 8)
            )
          ),
        });
        void speakLine(result.line);
      } else {
        setPartial({
          hypeScore: Math.min(
            100,
            Math.round(
              motionRef.current.paceKmh * 4 +
                motionRef.current.movementIntensity * 30 +
                Math.min(40, elapsed / 60000 * 8)
            )
          ),
        });
      }
    }, 1500);

    setPartial({ phase: "live" });
  }, [settings.athleteName, settings.elevenKey, settings.hypeLevel, setPartial, speakLine]);

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
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
    }
    setPartial({ phase: "idle", interim: "" });
  }, [setPartial]);

  const simulate = useCallback((kmh: number) => {
    trackerRef.current?.simulate(kmh);
  }, []);

  useEffect(() => () => {
    if (tickRef.current != null) clearInterval(tickRef.current);
    trackerRef.current?.stop();
    speechRef.current?.stop();
    crowdAudioRef.current?.pause();
  }, []);

  return { status, start, stop, simulate, speakLine };
}

function playUrl(url: string, audioRef: React.RefObject<HTMLAudioElement | null>): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

function browserSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 0.95;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}
