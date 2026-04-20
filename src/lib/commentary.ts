/**
 * Commentary engine. Watches motion + speech signals and produces broadcast lines.
 * Entirely template-driven so the app works offline of any LLM.
 */

import type { MotionState } from "./motion";

export type Signal = {
  athleteName: string;
  motion: MotionState;
  lastTranscript: string | null;
  lastTranscriptAgeMs: number;
  elapsedInSessionMs: number;
  hypeLevel: number; // 1-5
};

export type Trigger =
  | "opening"
  | "quote"
  | "pace-surge"
  | "pace-crash"
  | "steady"
  | "milestone-km"
  | "check-in"
  | "surroundings"
  | "ad-break"
  | "weather"
  | "finish-strong"
  | "signoff";

export type Line = {
  trigger: Trigger;
  text: string;
  urgency: 1 | 2 | 3; // 1 low, 3 dramatic
};

const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function pace(kmh: number) {
  if (kmh < 2.5) return "cooldown";
  if (kmh < 6) return "walk";
  if (kmh < 10) return "jog";
  if (kmh < 16) return "run";
  return "bike";
}

function paceWord(kmh: number) {
  return {
    cooldown: "a hero's stroll",
    walk: "a power walk",
    jog: "a respectable jog",
    run: "a serious pace",
    bike: "ridiculous speed",
  }[pace(kmh)];
}

const HYPE_PREFIXES = [
  "Ladies and gentlemen,",
  "Folks,",
  "Oh my word —",
  "Can you believe this?",
  "Coming to you LIVE,",
  "Unbelievable scenes —",
  "The crowd is on its feet —",
  "Are you watching this?",
  "I cannot stress this enough —",
  "Every pundit in the booth has gone quiet —",
  "This is the moment —",
  "Take a breath, because —",
  "History is watching —",
  "The commentators are speechless —",
];

export function buildOpening(s: Signal): Line {
  const name = s.athleteName;
  const opts = [
    `${rand(HYPE_PREFIXES)} welcome to STADIUM. Today's main event — ${name}. Weather: irrelevant. Stakes: everything. Broadcast is LIVE.`,
    `Good evening, good morning, good afternoon — depending on when and where you're watching. You are tuned in to STADIUM. The athlete tonight: ${name}. Let's get underway.`,
    `We are on the air. ${rand(HYPE_PREFIXES)} ${name} is in the tunnel. ${name} is crossing the line. ${name} is — well, ${name} is moving. This is STADIUM.`,
    `${rand(HYPE_PREFIXES)} it is a beautiful day for this. The sky is doing its thing. The birds are present. And in the middle of it all — ${name}. Broadcast: LIVE.`,
  ];
  return { trigger: "opening", urgency: 3, text: rand(opts) };
}

export function buildQuote(s: Signal): Line {
  const q = (s.lastTranscript || "").slice(0, 140);
  const name = s.athleteName;
  const opts = [
    `${name} speaks: "${q}" — the stadium falls silent.`,
    `Into the mic now — ${name}: "${q}". Will history remember this line? Almost certainly yes.`,
    `"${q}" — you heard it here first. Poetry in motion.`,
    `${name} with a direct quote for the record: "${q}". The commentators look at each other, speechless.`,
    `A statement from the athlete: "${q}". We will be unpacking this for weeks.`,
    `${name} addressing the crowd: "${q}". Electric. Simply electric.`,
    `Mid-stride, ${name} finds the words: "${q}". Put that on a poster.`,
    `"${q}" — a quote that will define the broadcast.`,
  ];
  return { trigger: "quote", urgency: 2, text: rand(opts) };
}

export function buildPaceSurge(s: Signal): Line {
  const kmh = s.motion.paceKmh.toFixed(1);
  const name = s.athleteName;
  const opts = [
    `${rand(HYPE_PREFIXES)} ${name} is KICKING! Up to ${kmh} kilometres per hour — where is this coming from?! The legs are GONE and yet — they keep going!`,
    `${rand(HYPE_PREFIXES)} ${name} has found another gear. ${kmh} kilometres per hour. The scouts are on their feet.`,
    `A surge! A beautiful, unscheduled surge. ${name} at ${kmh} kilometres per hour. Somebody notify the press.`,
    `${name} has seen something. Maybe a goal line, maybe a dog — whatever it is, they are now at ${kmh} kilometres per hour.`,
    `${rand(HYPE_PREFIXES)} did you see that shift? ${kmh} kilometres per hour. This is not a drill.`,
    `Out of nowhere — ${kmh}. ${name} has decided today is the day. I am getting chills. I am, on-air, getting chills.`,
  ];
  return { trigger: "pace-surge", urgency: 3, text: rand(opts) };
}

export function buildPaceCrash(s: Signal): Line {
  const kmh = s.motion.paceKmh.toFixed(1);
  const name = s.athleteName;
  const opts = [
    `A concerning dip. ${name} has slowed to ${kmh} kilometres per hour. The bench is worried. The dog is worried. We are all worried.`,
    `We are witnessing a recalibration. ${kmh} kilometres per hour. ${name} is playing chess out there, not checkers. Presumably.`,
    `${name} at ${kmh}. This is what the pundits call a strategic breather. Or — and I hesitate to say this — a vibe shift.`,
    `Slight wobble. ${kmh} kilometres per hour. The crowd leans in. Nobody dares speak.`,
    `Pace check — ${kmh}. ${name} is saving something for later. Has to be. Right? Right?`,
  ];
  return { trigger: "pace-crash", urgency: 2, text: rand(opts) };
}

export function buildSteady(s: Signal): Line {
  const kmh = s.motion.paceKmh.toFixed(1);
  const name = s.athleteName;
  const opts = [
    `${name} settling into ${paceWord(s.motion.paceKmh)} — ${kmh} kilometres per hour. Textbook form. The scouts are watching.`,
    `A steady ${kmh}. ${name} in the zone they call — let's call it — "the good one". Lovely stuff.`,
    `Metronomic. ${kmh} kilometres per hour. ${name} could do this in their sleep. They are possibly doing this in their sleep.`,
    `Rhythm established at ${kmh}. The kind of pace that wins championships. Not necessarily this one, but — championships.`,
  ];
  return { trigger: "steady", urgency: 1, text: rand(opts) };
}

export function buildMilestoneKm(s: Signal, km: number): Line {
  const name = s.athleteName;
  const opts = [
    `KILOMETRE ${km} — in the books. ${name} crosses the line, the crowd ERUPTS — they came here to see something special, and they are getting it.`,
    `That's kilometre ${km}. Write it down. Frame it. ${name} does it again.`,
    `${rand(HYPE_PREFIXES)} ${km} kilometres. Zero doubt. All conviction. This is what we came for.`,
    `Mark it — kilometre ${km}. The clock did not matter. Only the achievement. ${name}, take a bow.`,
    `Ladies and gentlemen, ${km} kilometres. ${name} is doing — and I want to be careful with this word — HISTORY.`,
  ];
  return { trigger: "milestone-km", urgency: 3, text: rand(opts) };
}

export function buildCheckIn(s: Signal): Line {
  const mins = Math.floor(s.motion.elapsedMs / 60000);
  const name = s.athleteName;
  const opts = [
    `${mins} minutes in. ${name} looks focused. Locked in. The commentators exchange a nod.`,
    `The clock reads ${mins} minutes. The lungs are working. The playlist is peaking. We are in the thick of it.`,
    `We are ${mins} minutes into the performance of ${name}'s career — and this broadcast stands behind every step.`,
    `${mins} minutes down. ${name} has that look. You know the look. We all know the look.`,
    `Clock check: ${mins} minutes. This is the part of the documentary where the music starts to swell.`,
    `${mins} on the clock. ${name} remembers why they started this. We do too. It was about three minutes ago.`,
  ];
  return { trigger: "check-in", urgency: 1, text: rand(opts) };
}

export function buildSurroundings(s: Signal): Line {
  const name = s.athleteName;
  const opts = [
    `A pedestrian has stopped to watch. They did not know today was going to go this way. None of us did.`,
    `A dog has taken notice of ${name}. Tail wagging. Absolute respect from the canine community.`,
    `Somewhere, a traffic light turns green at exactly the right moment. The universe approves.`,
    `A squirrel just witnessed pace. It will tell its friends. Its friends will not believe it.`,
    `A driver at a stop sign just clapped. ${name} did not notice. ${name} is locked in.`,
    `Two cyclists have just been passed in spirit, if not in distance. They are thinking about their choices.`,
    `A parent pushing a pram has nodded. A high honour, in this neighbourhood.`,
  ];
  return { trigger: "surroundings", urgency: 2, text: rand(opts) };
}

export function buildAdBreak(_s: Signal): Line {
  const opts = [
    `Brief word from our sponsors: LEGS. Keep using them. Back to the action.`,
    `This segment brought to you by OXYGEN — still free, still essential, still available at all major locations.`,
    `STADIUM is brought to you by STADIUM. The name of the app you are using. Thank you for using it.`,
    `A message from our partners: hydrate. That was the message. Back to the broadcast.`,
    `Sponsored by SHOES. Revolutionary foot technology. You may already be wearing some.`,
  ];
  return { trigger: "ad-break", urgency: 2, text: rand(opts) };
}

export function buildWeather(_s: Signal): Line {
  const opts = [
    `Weather report from the stadium: breezy. With a chance of personal record.`,
    `Conditions: excellent. For whom? For the athlete. As it should be.`,
    `Meteorological update: the sky is doing the sky thing. No complaints from the competitor.`,
    `Weather: vibes are mild, hype is high. Textbook.`,
  ];
  return { trigger: "weather", urgency: 1, text: rand(opts) };
}

export function buildFinishStrong(s: Signal): Line {
  const name = s.athleteName;
  const opts = [
    `Final stretch. This is the moment. Everything ${name} has trained for — and by "trained" we mean "opened this app" — it was all for this.`,
    `${rand(HYPE_PREFIXES)} we are approaching the close. ${name} with one more push in them. Maybe two. Let's not commit to two.`,
    `Home straight. The crowd stands. The commentator stands. The neighbour's cat stands. ${name} does not stand, because ${name} is still moving.`,
    `We're in the final minutes. ${name} has that look of someone about to earn a shower they will remember.`,
  ];
  return { trigger: "finish-strong", urgency: 3, text: rand(opts) };
}

export function buildSignoff(s: Signal): Line {
  const name = s.athleteName;
  const opts = [
    `And that is the final whistle. ${name} — what a performance. The scoreboard will never forget. This has been STADIUM. Goodnight, and keep moving.`,
    `That's your broadcast. ${name}, untouchable today. We will see you for the sequel. Unless this was the sequel — in which case, the trilogy.`,
    `Sign-off from STADIUM. ${name} wrote a sentence out there, and the crowd — the crowd will read it forever.`,
  ];
  return { trigger: "signoff", urgency: 3, text: rand(opts) };
}

export type EngineState = {
  hasOpened: boolean;
  lastTriggerAt: number; // in session ms
  lastPace: number;
  lastKmAnnounced: number;
  cooldownMs: number;
  interludeCount: number;
};

export const INITIAL_ENGINE: EngineState = {
  hasOpened: false,
  lastTriggerAt: -999999,
  lastPace: 0,
  lastKmAnnounced: 0,
  cooldownMs: 18000, // min gap between lines
  interludeCount: 0,
};

/**
 * Decide whether to emit a line this tick, and which one.
 * Returns null when the engine should stay quiet.
 */
export function decide(
  state: EngineState,
  signal: Signal
): { line: Line; next: EngineState } | null {
  const now = signal.elapsedInSessionMs;
  const sinceLast = now - state.lastTriggerAt;

  if (!state.hasOpened) {
    const line = buildOpening(signal);
    return {
      line,
      next: {
        ...state,
        hasOpened: true,
        lastTriggerAt: now,
        lastPace: signal.motion.paceKmh,
        lastKmAnnounced: 0,
      },
    };
  }

  // Quote takes priority when fresh transcript arrives.
  if (signal.lastTranscript && signal.lastTranscriptAgeMs < 2500 && sinceLast > 6000) {
    const line = buildQuote(signal);
    return {
      line,
      next: { ...state, lastTriggerAt: now, lastPace: signal.motion.paceKmh },
    };
  }

  if (sinceLast < state.cooldownMs) return null;

  const km = Math.floor(signal.motion.distanceMeters / 1000);
  if (km > state.lastKmAnnounced && km >= 1) {
    const line = buildMilestoneKm(signal, km);
    return {
      line,
      next: {
        ...state,
        lastTriggerAt: now,
        lastPace: signal.motion.paceKmh,
        lastKmAnnounced: km,
      },
    };
  }

  const dPace = signal.motion.paceKmh - state.lastPace;
  if (dPace > 2.5 && signal.motion.paceKmh > 8) {
    const line = buildPaceSurge(signal);
    return { line, next: { ...state, lastTriggerAt: now, lastPace: signal.motion.paceKmh } };
  }
  if (dPace < -2.5 && state.lastPace > 5) {
    const line = buildPaceCrash(signal);
    return { line, next: { ...state, lastTriggerAt: now, lastPace: signal.motion.paceKmh } };
  }

  const cadence = Math.max(18000, 55000 - signal.hypeLevel * 7000);
  if (sinceLast > cadence) {
    const line = pickFiller(state, signal);
    return {
      line,
      next: {
        ...state,
        lastTriggerAt: now,
        lastPace: signal.motion.paceKmh,
        interludeCount: state.interludeCount + 1,
      },
    };
  }

  return null;
}

/**
 * Picks a steady/check-in/flavour line, weighted so that every ~5 lines
 * the audience gets a sponsor bit, a weather report, or a surroundings
 * gag instead of another pace comment.
 */
function pickFiller(state: EngineState, signal: Signal): Line {
  const idx = state.interludeCount;

  if (idx > 0 && idx % 6 === 0) return buildAdBreak(signal);
  if (idx > 0 && idx % 5 === 0) return buildSurroundings(signal);
  if (idx > 0 && idx % 7 === 0) return buildWeather(signal);

  // Finish-strong bias if we're past 20 minutes.
  if (signal.motion.elapsedMs > 20 * 60 * 1000 && Math.random() < 0.3) {
    return buildFinishStrong(signal);
  }

  return Math.random() < 0.45 ? buildSteady(signal) : buildCheckIn(signal);
}
