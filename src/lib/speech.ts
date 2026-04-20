/**
 * Web Speech API wrapper for live mic transcription.
 * Falls back gracefully where SpeechRecognition is unavailable.
 */

type SR = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> & {
    [idx: number]: ArrayLike<{ transcript: string; confidence: number }> & { isFinal?: boolean };
  };
  resultIndex: number;
};

function getImpl(): (new () => SR) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechSupported() {
  return !!getImpl();
}

export type SpeechListener = {
  start: () => void;
  stop: () => void;
};

export function startSpeechListener(
  onTranscript: (text: string, isFinal: boolean) => void
): SpeechListener | null {
  const Impl = getImpl();
  if (!Impl) return null;

  const rec = new Impl();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  let killed = false;

  rec.onresult = (e) => {
    let finalText = "";
    let interim = "";
    for (let i = e.resultIndex; i < (e.results as ArrayLike<unknown>).length; i++) {
      const result = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean };
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) finalText += text;
      else interim += text;
    }
    if (finalText) onTranscript(finalText.trim(), true);
    else if (interim) onTranscript(interim.trim(), false);
  };

  rec.onend = () => {
    if (!killed) {
      try {
        rec.start();
      } catch { /* race; retry in 500ms */
        setTimeout(() => {
          if (!killed) try { rec.start(); } catch { /* give up */ }
        }, 500);
      }
    }
  };

  rec.onerror = () => { /* swallow — keep alive */ };

  try { rec.start(); } catch { /* already started */ }

  return {
    start: () => { killed = false; try { rec.start(); } catch { /* already */ } },
    stop: () => { killed = true; try { rec.stop(); } catch { /* not running */ } },
  };
}
