// Dev-only harness for the lens scene (not part of the production build).
//   /dev/scene-lab.html?card=support&t=12000   one frame, t ms after that card starts
//   &ripple=1  pinch ripples at the beads→fingers and comfortable→end cuts
//   &sense=scent  scent branch   &rm=1  reduced motion   &play=1  play in real time from t
// Playwright drives window.lab.render / window.lab.perf.
import type {GlassCard} from '../src/cards';
import type {LensScene} from '../src/contracts';
import {createScene} from '../src/scene';
import {seededRandom} from '../src/engine/engine';
import {DEFAULT_SEED} from '../src/engine/director';

const FRAME_MS = 33;

type Ev = {at: number; card?: GlassCard; ripple?: true};

const RC = (k: number): string => `Reconnect · ${k} of 6`;

/** #6 grew from 12 s to 14 s (SessionConfig 20:15): everything after it starts this much later. */
const FINGERS_GROWTH = 2000;
/** #10 is one 11 s move + 1.8 s fade (SessionEngine 21:06) instead of 23.25 + 1.8 s: #11 onwards starts 12.25 s earlier. */
const GAZE_GROWTH = -12250;
const shifted = (t: number): number => (t >= 90000 ? t + FINGERS_GROWTH : t) + (t >= 170650 ? GAZE_GROWTH : 0);

/** The engine's gaze direction for a seed (SessionEngine.expandView: the first draw of the PRNG). */
const gazeAngle = (seed: number): number => seededRandom(seed)() * 360;

/** The nominal 1× session (01-flow-and-copy §3.1), no pinches, preset 3. */
function flow(opts: {ripple: boolean; scent: boolean}): Ev[] {
  const ev: Ev[] = [];
  const at = (t: number, card: GlassCard): void => void ev.push({at: shifted(t), card});
  at(0, {kind: 'Intro', merging: false, durationMs: 4800});
  at(10000, {kind: 'Intro', merging: true, durationMs: 1400, fadeOutMs: 1000});
  at(13000, {kind: 'Support', sitFirst: true, durationMs: 23800});
  at(36800, {kind: 'Breath', breaths: 2, durationMs: 3000});
  let t = 39800;
  for (let i = 0; i < 2; i++) {
    at(t, {kind: 'BreathStep', phase: 'INHALE', durationMs: 3000, index: i, total: 2, countHold: false});
    at(t + 3000, {kind: 'BreathStep', phase: 'EXHALE', durationMs: 5000, index: i, total: 2, countHold: false});
    t += 8000;
  }
  const meta1 = RC(1);
  at(55800, {kind: 'Beads', turned: 1, total: 8, dir: -1, guide: true, meta: meta1});
  at(57200, {kind: 'Beads', turned: 2, total: 8, dir: -1, guide: true, meta: meta1});
  at(58600, {kind: 'Beads', turned: 0, total: 8, dir: -1, guide: false, meta: meta1});
  for (let k = 1; k <= 5; k++) at(66100 + (k - 1) * 2500, {kind: 'Beads', turned: k, total: 8, dir: -1, meta: meta1});
  if (opts.ripple) ev.push({at: 78600, ripple: true});
  at(78600, {kind: 'Fingers', durationMs: 14000});
  const items: Array<[string, string]> = [['Straight Item', '#FFFFFF'], ['Dark Item', '#8C8C8C'], ['Fabric Item', '#FFFFFF']];
  t = 90600;
  items.forEach(([label, colorHex], index) => {
    at(t, {kind: 'Find', stage: 'LOOK', label, colorHex, index, total: 3});
    at(t + 2500, {kind: 'Find', stage: 'NOTICE', label, colorHex, index, total: 3});
    at(t + 6000, {kind: 'Find', stage: 'ITEM', label, colorHex, index, total: 3});
    t += 10000;
  });
  at(120600, {kind: 'Sense', sense: opts.scent ? 'SCENT' : 'TEMPERATURE'});
  at(130600, {kind: 'SoundRings', prompt: 'One sound around you', title: 'Listen', meta: RC(5)});
  // Out once (move 7 s + hold 4 s), then the light fades (1.8 s).
  at(145600, {kind: 'Gaze', target: 'AWAY', instruction: '', meta: RC(6), angleDeg: gazeAngle(DEFAULT_SEED)});
  at(156600, {kind: 'Gaze', target: 'GONE', instruction: '', meta: RC(6)});
  at(170650, {kind: 'Text', title: 'Get comfortable', subtitle: 'Hair, clothes, posture', obj: 'Stem', over: 'Re-enter'});
  if (opts.ripple) ev.push({at: shifted(182650), ripple: true});
  at(182650, {kind: 'Ending', durationMs: 12700}); // #12, Figma Component 10 (12.7 s since 22:02)
  at(195350, {kind: 'Off'});
  at(197150, {kind: 'Blank'});
  return ev;
}

/** QuickExit from Listen: "You're ready." with the Exhale dot, Off, Blank. */
function quick(): Ev[] {
  const ev = flow({ripple: false, scent: false}).filter((e) => e.at < shifted(140600));
  ev.push({at: shifted(140600), card: {kind: 'Text', title: "You're ready.", subtitle: null, pose: 'Exhale'}});
  ev.push({at: shifted(145400), card: {kind: 'Off'}});
  ev.push({at: shifted(147200), card: {kind: 'Blank'}});
  return ev;
}

/** Card start offsets in the flow (lab names). */
const OFFSETS: Record<string, number> = Object.fromEntries(Object.entries({
  intro: 0, introExit: 10000, support: 13000, breath: 36800, inhale: 39800, exhale: 42800,
  beads: 55800, beadsTurn: 66100, fingers: 78600, find: 90600, find2: 100600, find3: 110600,
  sense: 120600, listen: 130600, gaze: 145600,
  gazeGone: 156600, comfortable: 170650, end: 182650, off: 195350, blank: 197150, quick: 140600,
}).map(([k, v]) => [k, shifted(v)]));

const DURATIONS: Record<string, number> = {
  intro: 10000, introExit: 3000, support: 23800, breath: 3000, inhale: 3000, exhale: 5000,
  beads: 22800, beadsTurn: 12500, fingers: 14000, find: 10000, find2: 10000, find3: 10000,
  sense: 10000, listen: 15000, gaze: 11000,
  gazeGone: 1800, comfortable: 12000, end: 12700, off: 1800, blank: 2000, quick: 6600,
};

interface LabOpts {
  ripple?: boolean;
  scent?: boolean;
  rm?: boolean;
}

class Runner {
  scene: LensScene;
  now = 0;
  private i = 0;

  constructor(private readonly events: Ev[], rm: boolean) {
    this.scene = createScene();
    this.scene.reducedMotion = rm;
  }

  /** Steps the scene in 33 ms frames up to virtual time [t], applying events on the way. */
  advance(t: number): void {
    while (this.now < t) {
      const dt = Math.min(FRAME_MS, t - this.now);
      this.now += dt;
      this.applyDue();
      this.scene.step(dt);
    }
  }

  applyDue(): void {
    while (this.i < this.events.length && (this.events[this.i]?.at ?? Infinity) <= this.now) {
      const e = this.events[this.i++];
      if (!e) continue;
      if (e.ripple) this.scene.ripple();
      if (e.card) this.scene.apply(e.card);
    }
  }
}

const canvas = document.getElementById('lens') as HTMLCanvasElement;
const info = document.getElementById('info') as HTMLDivElement;
let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

function eventsFor(card: string, o: LabOpts): Ev[] {
  return card === 'quick' ? quick() : flow({ripple: !!o.ripple, scent: !!o.scent});
}

function render(card: string, t: number, o: LabOpts = {}): string {
  const r = new Runner(eventsFor(card, o), !!o.rm);
  const start = OFFSETS[card] ?? 0;
  r.advance(start + t);
  r.scene.draw(ctx);
  const line = `${card} t=${t} flow=${start + t}`;
  info.textContent = line;
  return line;
}

/** Renders arbitrary cards (applied at 0, 33, 66 … ms) at virtual time [t] — for layout checks. */
function renderCards(cards: GlassCard[], t: number): void {
  const r = new Runner(cards.map((card, i) => ({at: i * FRAME_MS, card})), false);
  r.advance(t);
  r.scene.draw(ctx);
  info.textContent = `custom t=${t}`;
}

interface PerfResult {
  card: string;
  frames: number;
  avg: number;
  p95: number;
  max: number;
  stepAvg: number;
}

/**
 * Plays [card] frame by frame (33 ms virtual) and times draw() + a 1-px readback that forces the
 * canvas to rasterise inside the timed region. soft = CPU-rasterised canvas (pessimistic).
 */
function perf(card: string, o: LabOpts & {soft?: boolean; dur?: number} = {}): PerfResult {
  const c2 = document.createElement('canvas');
  c2.width = 600;
  c2.height = 600;
  const pctx = c2.getContext('2d', {willReadFrequently: !!o.soft}) as CanvasRenderingContext2D;
  const r = new Runner(eventsFor(card, o), !!o.rm);
  const start = OFFSETS[card] ?? 0;
  const dur = o.dur ?? DURATIONS[card] ?? 5000;
  r.advance(start);
  r.scene.draw(pctx);
  pctx.getImageData(0, 0, 1, 1);
  const times: number[] = [];
  let stepSum = 0;
  while (r.now < start + dur) {
    const t0 = performance.now();
    r.now += FRAME_MS;
    r.applyDue();
    r.scene.step(FRAME_MS);
    const t1 = performance.now();
    r.scene.draw(pctx);
    pctx.getImageData(0, 0, 1, 1);
    const t2 = performance.now();
    stepSum += t1 - t0;
    times.push(t2 - t1);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
  return {
    card,
    frames: times.length,
    avg,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    stepAvg: stepSum / Math.max(1, times.length),
  };
}

/**
 * Cold run of the whole session on a fresh scene: per-frame step + draw (+1-px readback) cost,
 * so first-time bakes show up as spikes. Returns frames slower than [spikeMs] with their flow time.
 */
function perfFlow(o: LabOpts & {soft?: boolean; spikeMs?: number} = {}): {frames: number; avg: number; p95: number; spikes: Array<[number, number]>} {
  const c2 = document.createElement('canvas');
  c2.width = 600;
  c2.height = 600;
  const pctx = c2.getContext('2d', {willReadFrequently: !!o.soft}) as CanvasRenderingContext2D;
  const r = new Runner(eventsFor('flow', o), !!o.rm);
  const times: number[] = [];
  const spikes: Array<[number, number]> = [];
  while (r.now < shifted(198700)) {
    const t0 = performance.now();
    r.now += FRAME_MS;
    r.applyDue();
    r.scene.step(FRAME_MS);
    r.scene.draw(pctx);
    pctx.getImageData(0, 0, 1, 1);
    const d = performance.now() - t0;
    times.push(d);
    if (d > (o.spikeMs ?? 8)) spikes.push([r.now, Math.round(d * 10) / 10]);
  }
  const sorted = [...times].sort((a, b) => a - b);
  return {frames: times.length, avg: times.reduce((a, b) => a + b, 0) / times.length, p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0, spikes};
}

function play(card: string, t: number, o: LabOpts): void {
  const r = new Runner(eventsFor(card, o), !!o.rm);
  r.advance((OFFSETS[card] ?? 0) + t);
  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(50, now - last);
    last = now;
    r.now += dt;
    r.applyDue();
    r.scene.step(dt);
    r.scene.draw(ctx);
    info.textContent = `${card} flow=${Math.round(r.now)}`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function loadFont(): Promise<void> {
  const face = new FontFace('Elms Sans', 'url(/fonts/elms-sans-latin-v1.woff2)', {weight: '100 900'});
  await face.load();
  document.fonts.add(face);
  await document.fonts.ready;
}

/** Widths of one string per weight: different numbers prove the woff2 is variable. */
function weightProbe(): Record<number, number> {
  const m = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  const out: Record<number, number> = {};
  for (const w of [100, 200, 300, 400, 600, 900]) {
    m.font = `${w} 40px "Elms Sans"`;
    out[w] = Math.round(m.measureText('Take a moment').width * 100) / 100;
  }
  return out;
}

declare global {
  interface Window {
    lab: {
      ready: Promise<void>;
      render: typeof render;
      perf: typeof perf;
      perfFlow: typeof perfFlow;
      renderCards: typeof renderCards;
      offsets: Record<string, number>;
      durations: Record<string, number>;
      weightProbe: typeof weightProbe;
      setSoft: (soft: boolean) => void;
    };
  }
}

const ready = loadFont();
window.lab = {
  ready,
  render,
  perf,
  perfFlow,
  renderCards,
  offsets: OFFSETS,
  durations: DURATIONS,
  weightProbe,
  setSoft: (soft) => {
    ctx = canvas.getContext('2d', {willReadFrequently: soft}) as CanvasRenderingContext2D;
  },
};

void ready.then(() => {
  const q = new URLSearchParams(location.search);
  const card = q.get('card');
  if (!card) return;
  const t = Number(q.get('t') ?? '0');
  const o: LabOpts = {ripple: q.get('ripple') === '1', scent: q.get('sense') === 'scent', rm: q.get('rm') === '1'};
  if (q.get('play') === '1') play(card, t, o);
  else render(card, t, o);
});
