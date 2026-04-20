import { useEffect, useState } from "react";

export type Settings = {
  elevenKey: string;
  athleteName: string;
  voiceId: string;
  hypeLevel: number; // 1-5
  useConvai: boolean;
};

const ENV_KEY =
  (import.meta.env?.VITE_ELEVENLABS_API_KEY as string | undefined)?.trim() || "";

const DEFAULTS: Settings = {
  elevenKey: ENV_KEY,
  athleteName: "THE ATHLETE",
  voiceId: "JBFqnCBsd6RMkjVDRZzb", // "George" — a clean broadcast voice preset available on all plans
  hypeLevel: 4,
  useConvai: false,
};

const KEY = "stadium:settings:v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // Env key takes precedence when the user hasn't explicitly set one in the UI
    const elevenKey = parsed.elevenKey?.trim() || ENV_KEY;
    return { ...DEFAULTS, ...parsed, elevenKey };
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
