// Session timings and settings. Port of momo-android session/SessionConfig.kt (snapshot 22:02).
// All durations are design ms at 1×. The web app keeps timeScale = 1: the director's ?speed
// multiplies dt in main.ts instead, so pictures and timers scale together.

export type BreathingPattern = 'CALM' | 'CYCLIC_SIGH' | 'COUNT_HOLD';

/** The six Reconnect steps (USER_FLOW #5–#10), in flow order. */
export type ReconnectStep = 'BEADS' | 'FINGERS' | 'FIND_THREE' | 'TOUCH' | 'LISTEN' | 'EXPAND_VIEW';

export const RECONNECT_STEPS: readonly ReconnectStep[] = [
  'BEADS',
  'FINGERS',
  'FIND_THREE',
  'TOUCH',
  'LISTEN',
  'EXPAND_VIEW',
];

/** USER_FLOW step number of each Reconnect step (fixed even when steps are switched off). */
export const RECONNECT_STEP_NUMBER: Readonly<Record<ReconnectStep, number>> = {
  BEADS: 5,
  FINGERS: 6,
  FIND_THREE: 7,
  TOUCH: 8,
  LISTEN: 9,
  EXPAND_VIEW: 10,
};

export interface Timings {
  /** The logo drawing itself in (every element is in by 4.8 s of logo.html's timeline). */
  readonly introOpen: number;
  readonly introAutoStart: number;
  /** Web: after the start pinch, the start screen holds while "Take a moment." plays (~1.5 s clip, slower as speech). */
  readonly introBeginHold: number;
  /** Exit: the logo un-draws to its centre dot … */
  readonly introMerge: number;
  /** … the dot and the words fade to black … */
  readonly introFade: number;
  /** … and the lens stays dark for a moment before #3 fades in. */
  readonly introGap: number;
  /** Hidden balance check during #2 (skipped by the web app; kept for parity). */
  readonly balanceSample: number;
  /** #3 stand → sit → settle … */
  readonly supportSit: number;
  /** … then the support ring pulses three times and the picture fades. */
  readonly supportRings: number;
  readonly breathIntro: number;
  readonly calmIn: number;
  readonly calmOut: number;
  readonly sighIn: number;
  readonly sighTopUp: number;
  readonly sighOut: number;
  readonly countIn: number;
  readonly countHold: number;
  readonly countOut: number;
  readonly beads: number;
  readonly beadIdleBeforeAuto: number;
  readonly beadAutoEvery: number;
  readonly fingers: number;
  /** #7 per item: 6.1 "Take a Look Around." … */
  readonly findLook: number;
  /** … 6.2 "Notice the ___ Nearby." with the coloured circle … */
  readonly findNotice: number;
  /** … 6.3 the same words with the dotted cup. */
  readonly findItem: number;
  /** #8 "Notice Its Scent." / "Feel Its Temperature." */
  readonly sense: number;
  /** #8: "Notice what you're touching." … then "Take your time." */
  readonly senseSecondLine: number;
  readonly listen: number;
  /** #9: "Now, notice one sound around you." … then "You don't need to react to it. Just notice it." */
  readonly listenSecondLine: number;
  /** #10: one slow move of the light in a random direction (the scene's spring takes ~5 s) … */
  readonly gazeMove: number;
  /** … then it rests there before it fades. */
  readonly gazeHold: number;
  readonly comfortable: number;
  /** #11: "Adjust your hair or clothing…" … then "When you're ready, check your camera and framing." */
  readonly comfortableSecondLine: number;
  readonly end: number;
  readonly quick: number;
  readonly fade: number;
  /** Real-app AI limits (never scaled in Kotlin). Unused here: the web app has no AI call. */
  readonly visionTimeout: number;
  readonly visionGrace: number;
}

export const DEFAULT_TIMINGS: Timings = {
  introOpen: 4_800,
  introAutoStart: 10_000,
  introBeginHold: 1_800,
  introMerge: 1_400,
  introFade: 1_000,
  introGap: 600,
  balanceSample: 3_000,
  supportSit: 7_800,
  supportRings: 16_000,
  breathIntro: 3_000,
  calmIn: 3_000,
  calmOut: 5_000,
  sighIn: 2_000,
  sighTopUp: 1_000,
  sighOut: 5_000,
  countIn: 3_000,
  countHold: 3_000,
  countOut: 4_000,
  beads: 20_000,
  beadIdleBeforeAuto: 6_000,
  beadAutoEvery: 2_500,
  /** #6: two rubs (4.8 s), the bracelet fades (2 s), the caption page fades in (1.6 s), then ~5.6 s to read it. */
  fingers: 14_000,
  findLook: 2_500,
  findNotice: 3_500,
  findItem: 4_000,
  sense: 10_000,
  senseSecondLine: 5_000,
  listen: 15_000,
  listenSecondLine: 6_000,
  gazeMove: 7_000,
  gazeHold: 4_000,
  comfortable: 12_000,
  comfortableSecondLine: 5_000,
  /** #12 orbit.html: hold .8 + orbit 9 + closed .7 + fade 2.2 s. */
  end: 12_700,
  quick: 4_800,
  fade: 1_800,
  visionTimeout: 8_000,
  visionGrace: 3_000,
};

export interface SessionConfig {
  /** Multiplies every engine wait and card duration (Kotlin: 0.3 = "fast demo"). Keep 1 on the web. */
  readonly timeScale: number;
  readonly timings: Timings;
  readonly breathing: BreathingPattern;
  readonly steps: ReadonlySet<ReconnectStep>;
  readonly beadsToTurn: number;
  /** Phone-only haptics/music flags, kept for parity; the web app has neither. */
  readonly slowHeartbeat: boolean;
  readonly music: boolean;
  readonly reduceMotion: boolean;
}

export const DEFAULT_CONFIG: SessionConfig = {
  timeScale: 1,
  timings: DEFAULT_TIMINGS,
  breathing: 'CALM',
  steps: new Set(RECONNECT_STEPS),
  beadsToTurn: 8,
  slowHeartbeat: true,
  music: false,
  reduceMotion: false,
};

/** Kotlin `scaled(ms) = (ms × timeScale).toLong().coerceAtLeast(1)` (SessionEngine.kt:120). */
export function scaled(config: SessionConfig, ms: number): number {
  return Math.max(1, Math.trunc(ms * config.timeScale));
}
