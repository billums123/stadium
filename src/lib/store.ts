import { useEffect, useState } from "react";

export type Settings = {
  elevenKey: string;
  athleteName: string;
  voiceId: string;
  hypeLevel: number; // 1-5
  useConvai: boolean;
};

const DEFAULTS: Settings = {
  elevenKey: "",
  athleteName: "THE ATHLETE",
  voiceId: "JBFqnCBsd6RMkjVDRZzb", // ElevenLabs "George" — a clean broadcast voice preset available on all plans
  hypeLevel: 4,
  useConvai: false,
};

const KEY = "stadium:settings:v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
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
