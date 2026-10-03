// Mutable scene state (the fields of GlassScene.kt that the v2.1 flow uses, GS:52-164).
// reset() simply replaces the whole State; sprite caches live in the modules and survive.
import type {BreathPhase, FindStage, ObjectKind, SenseKind} from '../cards';
import {MotionTokens, Spring, springSpec, type SpringSpec} from '../motion';
import {ACCENT} from './palette';
import {TextSystem, type Clock} from './text';

export type Mode =
  | 'BLANK' | 'TEXT' | 'INTRO' | 'SUPPORT' | 'FIND' | 'SENSE' | 'PHASE' | 'BREATH' | 'SWATCH'
  | 'RINGS' | 'STEPS' | 'PHRASE' | 'CHOICE' | 'STAR' | 'BEADS' | 'GAZE' | 'OFF';

export interface BreathSt {
  phase: BreathPhase;
  start: number;
  dur: number;
  from: number;
  to: number;
  innerFrom: number;
  outerFrom: number;
}

export interface Icon {
  kind: ObjectKind;
  born: number;
  op: Spring;
  s: Spring;
  outAt: number;
}

export interface Ripple {
  x: number;
  y: number;
  s: number;
  t0: number;
}

interface Later {
  at: number;
  epoch: number;
  fn: () => void;
}

/** Gaze trail samples (x, y, t) in a fixed ring buffer — no per-frame allocation. */
export class Trail {
  static readonly CAP = 128;
  readonly buf = new Float64Array(Trail.CAP * 3);
  head = 0; // index of the oldest sample
  size = 0;

  push(x: number, y: number, t: number): void {
    if (this.size === Trail.CAP) {
      this.head = (this.head + 1) % Trail.CAP;
      this.size--;
    }
    const i = ((this.head + this.size) % Trail.CAP) * 3;
    this.buf[i] = x;
    this.buf[i + 1] = y;
    this.buf[i + 2] = t;
    this.size++;
  }

  dropOlderThan(t: number): void {
    while (this.size > 0 && (this.buf[this.head * 3 + 2] ?? 0) < t) {
      this.head = (this.head + 1) % Trail.CAP;
      this.size--;
    }
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
  }
}

export class State {
  readonly clock: Clock = {now: 0};
  readonly springs: Spring[] = [];
  readonly texts = new TextSystem(this.clock);

  private sp(v: number, s: SpringSpec = MotionTokens.Calm): Spring {
    const x = new Spring(v, s);
    this.springs.push(x);
    return x;
  }

  // Momo dot (GS:56-62)
  readonly o = {
    x: this.sp(300), y: this.sp(250), w: this.sp(0), h: this.sp(0),
    corner: this.sp(1), rot: this.sp(0), op: this.sp(0), fill: this.sp(1),
    r: this.sp(ACCENT[0], MotionTokens.Color), g: this.sp(ACCENT[1], MotionTokens.Color), b: this.sp(ACCENT[2], MotionTokens.Color),
    steady: this.sp(0), drift: this.sp(0),
  };

  // Breathing ring (GS:63-65, GS:152-156)
  readonly guideOp = this.sp(0);
  ringInnerA = 1;
  ringOuterA = 1;
  readonly bloom = this.sp(0);
  breath: BreathSt | null = null;

  // Listen rings (GS:68-69)
  readonly rings = [50, 90, 130].map((base) => ({base, r: this.sp(60), op: this.sp(0)}));
  readonly energy = [0.4, 0.4, 0.4];

  readonly stem = this.sp(0, MotionTokens.Stem);

  // Support (GS:85-89)
  readonly supportOp = this.sp(0);
  supFrom = 0;
  supStart = 0;
  supDur = 1;

  // Find (GS:92-95)
  readonly findCircleOp = this.sp(0);
  readonly findCupOp = this.sp(0);
  readonly findR = this.sp(255, MotionTokens.Color);
  readonly findG = this.sp(255, MotionTokens.Color);
  readonly findB = this.sp(255, MotionTokens.Color);
  findT0 = 0;
  findStage: FindStage | null = null;

  // Sense (GS:98-100)
  readonly senseOp = this.sp(0);
  senseKind: SenseKind = 'TEMPERATURE';
  senseT0 = 0;

  // Beads, Figma 4.0: how many spots the beads have moved down (a fraction while turning), easing
  // from beadFrom at beadStart to beadTarget. beadPulseAt: Reduce motion's per-turn cue.
  readonly beadsOp = this.sp(0);
  beadFrom = 0;
  beadTarget = 0;
  beadStart = 0;
  beadTurned = 0;
  beadPulseAt = -1;

  // Gaze (GS:111-114)
  readonly gazeOp = this.sp(0);
  readonly gazeX = this.sp(300, springSpec(5, 1));
  readonly gazeY = this.sp(250, springSpec(5, 1));
  readonly trail = new Trail();
  /** Virtual time of the last trail sample (sampled at a fixed 60 Hz). */
  trailAt = -1;

  // Intro (GS:119-125)
  readonly introOp = this.sp(0);
  introFrom = 0;
  introTo = 0;
  introStart = 0;
  introDur = 1;
  introMerging = false;
  introFadeMs = 0;

  mode: Mode = 'BLANK';
  epoch = 0;
  private laters: Later[] = [];

  icons: Icon[] = [];
  ripples: Ripple[] = [];

  get now(): number {
    return this.clock.now;
  }

  later(ms: number, fn: () => void): void {
    this.laters.push({at: this.clock.now + ms, epoch: this.epoch, fn});
  }

  runLaters(): void {
    if (this.laters.length === 0) return;
    const now = this.clock.now;
    const due = this.laters.filter((l) => l.at <= now);
    if (due.length === 0) return;
    this.laters = this.laters.filter((l) => l.at > now);
    for (const l of due) if (l.epoch === this.epoch) l.fn();
  }

  /** Reduce motion: jump every animation to its end state (snapAll, GS:600-606). */
  snapAll(): void {
    for (const s of this.springs) s.snap();
    this.beadFrom = this.beadTarget;
    this.texts.snapAll();
    this.icons = this.icons.filter((i) => i.outAt < 0);
    for (const i of this.icons) {
      i.op.set(1);
      i.s.set(1);
    }
  }
}
