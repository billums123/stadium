import { useEffect, useState } from "react";
import { DEFAULT_MODEL as DEFAULT_LLM_MODEL } from "./llm";
import type { Goal } from "./goal";

export type Settings = {
  athleteName: string;
  voiceId: string;       // play-by-play commentator
  colorVoiceId: string;  // color commentator
  hypeLevel: number;     // 1-5, a floor — live intensity climbs past it
  useDynamic: boolean;   // LLM-generated lines on top of the template engine
  useMic: boolean;       // enable Web Speech API mic-quote line
  llmModel: string;
  goal: Goal | null;     // null = free run
};

const DEFAULTS: Settings = {
  athleteName: "THE ATHLETE",
  // Two voices picked for contrast: a warm Southern-baritone broadcaster
  // on play-by-play (George Daigle, shared library), and the operator's
  // custom-designed "Hype Sports Announcer" as the hyped color voice.
  voiceId: "1GCQiLWWVadqyDYY3CK9",       // George Daigle — Southern broadcast baritone
  colorVoiceId: "teSzrMn7PRfLv5Q5Fkob",  // Hype Sports Announcer (custom generated)
  hypeLevel: 4,
  useDynamic: true,
  // Mic off by default. When enabled the browser opens the microphone,
  // which on most phones engages Acoustic Echo Cancellation on all
  // playback — making the TTS output sound compressed / robotic. Only
  // worth turning on with earbuds in.
  useMic: false,
  llmModel: DEFAULT_LLM_MODEL,
  goal: null,
};

const KEY = "stadium:settings:v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [state, setState] = useState<Settings>(() => loadSettings());
  useEffect(() => {
    saveSettings(state);
  }, [state]);
  const update = (patch: Partial<Settings>) => setState((s) => ({ ...s, ...patch }));
  return [state, update];
}
