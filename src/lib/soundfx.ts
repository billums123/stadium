/**
 * Web Audio synthesised cues used for the broadcast cold-open:
 *   - `countdownBeep()` plays a short 800 Hz blip (1200 Hz on the final
 *     one) for each of the 3-2-1 visual ticks.
 *   - `startingHorn()` plays a layered air-horn + noise burst for the
 *     "GO" moment.
 *
 * Synthesised rather than pre-recorded so there's no round-trip, no
 * licensing concern, and the timing stays rock-solid regardless of
 * network state.
 */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Short tick; `final` bumps the pitch for the last beep in a countdown. */
export function countdownBeep(final = false): void {
  const ac = audioContext();
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(final ? 1200 : 800, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 0.35 : 0.18));

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + (final ? 0.4 : 0.22));
}

/**
 * 1.4 s stadium air-horn + noise burst. Two detuned saw oscillators
 * pitch-bend slightly up like a real horn, layered over a short band-
 * passed noise burst for the transient "bang".
 */
export function startingHorn(): Promise<void> {
  const ac = audioContext();
  const now = ac.currentTime;
  const duration = 1.25;

  // Noise burst — starting-gun transient.
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.exp(-i / (ac.sampleRate * 0.04));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 2500;
  noiseFilter.Q.value = 0.8;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.75, now);
  noise.connect(noiseFilter).connect(noiseGain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.25);

  // Air-horn body — two detuned sawtooths harmonised a perfect fifth apart.
  const horn = (base: number, detune: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(base, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(base * 1.05, now + 0.15);
    osc.detune.value = detune;

    gain.gain.setValueAtTime(0.0001, now + 0.04);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.1);
    gain.gain.setValueAtTime(0.32, now + duration - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2800;
    filter.Q.value = 0.8;

    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start(now + 0.04);
    osc.stop(now + duration);
  };
  horn(220, -6);
  horn(330, 6);

  return new Promise((resolve) => setTimeout(resolve, Math.round(duration * 1000)));
}

/**
 * Triumphant 2.2s victory horn — three layered air-horn stabs on a
 * rising major-chord arpeggio, fuller + brighter than the starting
 * horn. Played on goal complete to punctuate the finish.
 */
export function victoryHorn(): Promise<void> {
  const ac = audioContext();
  const now = ac.currentTime;
  const duration = 2.2;

  // Initial noise crack — the "airhorn puff" transient.
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.35, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.exp(-i / (ac.sampleRate * 0.06));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 3200;
  noiseFilter.Q.value = 0.7;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.85, now);
  noise.connect(noiseFilter).connect(noiseGain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.35);

  // Three stacked stabs on a major triad (root + third + fifth),
  // each 0.55s apart, giving a short "bah bah BAAAH" victory motif.
  const stab = (base: number, detune: number, startOffset: number, length: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(base, now + startOffset + 0.02);
    osc.frequency.exponentialRampToValueAtTime(base * 1.03, now + startOffset + 0.1);
    osc.detune.value = detune;

    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.linearRampToValueAtTime(0.38, now + startOffset + 0.06);
    gain.gain.setValueAtTime(0.38, now + startOffset + length - 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + length);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3200;
    filter.Q.value = 0.9;

    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + length);
  };

  // Root at A3 (220), third at C#4 (277), fifth at E4 (330).
  // First stab at t=0, second at t=0.55 (tonic+third), third sustained finish.
  stab(220, -8, 0.0, 0.35);
  stab(277, 0,  0.0, 0.35);
  stab(330, 8,  0.0, 0.35);

  stab(220, -8, 0.55, 0.35);
  stab(277, 0,  0.55, 0.35);
  stab(330, 8,  0.55, 0.35);

  // Third stab is longer — the sustained crescendo.
  stab(220, -10, 1.1, 1.05);
  stab(277,  0,  1.1, 1.05);
  stab(330, 10,  1.1, 1.05);
  stab(440,  0,  1.1, 1.05); // octave up on top for the "yes!" brightness

  return new Promise((resolve) => setTimeout(resolve, Math.round(duration * 1000)));
}

/** Kick the context alive during a user gesture so autoplay doesn't
 *  gate the countdown. Also plays a silent WAV through an HTMLAudio
 *  element, which is what iOS Safari actually keys its "audio is
 *  allowed this session" flag to — without this, any later
 *  `new Audio(blob).play()` (i.e. every TTS line) silently fails
 *  because the blob is created after await boundaries have dropped
 *  the gesture scope. MUST be called synchronously inside the click
 *  handler, before any `await`. */
export function primeAudio(): void {
  audioContext();
  try {
    const silent = new Audio(
      "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA=="
    );
    silent.volume = 0;
    void silent.play().catch(() => {});
  } catch { /* no-op */ }
}
