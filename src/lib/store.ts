import { useEffect, useState } from "react";
import { DEFAULT_MODEL as DEFAULT_LLM_MODEL } from "./llm";
import type { Goal } from "./goal";

export type Settings = {
  elevenKey: string;
  openaiKey: string;
  athleteName: string;
  voiceId: string;       // play-by-play commentator
  colorVoiceId: string;  // color commentator (the dry second voice)
  hypeLevel: number;     // 1-5, a floor — live intensity can climb past it
  useDynamic: boolean;   // LLM-generated lines when a key is present
  llmModel: string;
  goal: Goal | null;     // null = free run
};

const ENV_ELEVEN =
  (import.meta.env?.VITE_ELEVENLABS_API_KEY as string | undefined)?.trim() || "";
const ENV_OPENAI =
  (import.meta.env?.VITE_OPENAI_API_KEY as string | undefined)?.trim() || "";

const DEFAULTS: Settings = {
  elevenKey: ENV_ELEVEN,
  openaiKey: ENV_OPENAI,
  athleteName: "THE ATHLETE",
  // Two voices picked for contrast: a steady broadcast baritone on
  // play-by-play, and a high-energy sports/gaming commentator (Ninja
  // from the ElevenLabs shared library) as the hyped color voice.
  voiceId: "JBFqnCBsd6RMkjVDRZzb",       // George — broadcast baritone
  colorVoiceId: "DcLiO3XaUWTu3gyon6hW",  // Ninja — Hype Gaming Commentary
  hypeLevel: 4,
  useDynamic: true,
  llmModel: DEFAULT_LLM_MODEL,
  goal: null,
};

const KEY = "stadium:settings:v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // Env keys win when the user hasn't explicitly set one in the UI.
    const elevenKey = parsed.elevenKey?.trim() || ENV_ELEVEN;
    const openaiKey = parsed.openaiKey?.trim() || ENV_OPENAI;
    return { ...DEFAULTS, ...parsed, elevenKey, openaiKey };
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
